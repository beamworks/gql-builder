import {
  ASTNode,
  Kind,
  OperationTypeNode,
  SelectionSetNode,
  FieldNode,
  TypeNode,
} from "graphql";

// variable input definition object
export const VAR_MARKER = Symbol("var marker");
export type VarDefinition<VarName extends string, VarType extends string> = {
  [VAR_MARKER]: [VarName, VarType];
};

// field arguments map
export interface ArgumentsShape {
  [paramName: string]: VarDefinition<string, string>;
}

// full field definition object
export const FIELD_MARKER = Symbol("field marker");
export type FieldDefinition<
  Name extends string | null, // null means infer from field name
  Args extends ArgumentsShape | null,
  Selection
> = {
  [FIELD_MARKER]: [Name, Args, Selection];
};

// using the weird "ask to TS keep strings narrow" trick from:
// https://stackoverflow.com/questions/59440453/dynamically-generate-return-type-based-on-array-parameter-of-objects-in-typescri
// and discussed here: https://github.com/microsoft/TypeScript/issues/30680
export type SelectionShape<MagicNarrowString extends string> = {
  [FIELD_MARKER]?: undefined; // disambiguation

  [key: string]:
    | MagicNarrowString
    | SelectionShape<MagicNarrowString>
    | FieldDefinition<
        MagicNarrowString | null,
        ArgumentsShape | null,
        SelectionShape<MagicNarrowString> | string
      >;
};

function isFieldDef(
  obj: SelectionShape<string> | FieldDefinition<any, any, any>
): obj is FieldDefinition<any, any, any> {
  return obj[FIELD_MARKER] !== undefined;
}

export function produceSimpleFieldSet(
  selection: SelectionShape<string>,
  allVars: { [name: string]: string }
): SelectionSetNode {
  return {
    kind: Kind.SELECTION_SET,
    selections: Object.keys(selection).map((field): FieldNode => {
      const value = selection[field];

      if (typeof value === "string") {
        return {
          kind: Kind.FIELD,
          name: {
            kind: Kind.NAME,
            value: field,
          },
        };
      }

      if (isFieldDef(value)) {
        const [name, args, subSelection] = value[FIELD_MARKER];
        const selectionSet =
          typeof subSelection === "string"
            ? undefined // simple field
            : produceSimpleFieldSet(subSelection, allVars);

        return {
          kind: Kind.FIELD,
          name: {
            kind: Kind.NAME,
            value: name === null ? field : name,
          },
          alias:
            name === null
              ? undefined
              : {
                  kind: Kind.NAME,
                  value: field,
                },
          arguments: args
            ? Object.keys(args).map((argKey) => {
                const param = args[argKey];
                const [varName, varType] = param[VAR_MARKER];

                const existingType = allVars[varName];
                if (existingType) {
                  // assert that the type is consistent in all spots
                  if (existingType !== varType) {
                    throw new Error(
                      `variable type mismatch for $${varName}: ${varType} vs ${existingType}`
                    );
                  }
                } else {
                  allVars[varName] = varType;
                }

                return {
                  kind: Kind.ARGUMENT,
                  name: {
                    kind: Kind.NAME,
                    value: argKey,
                  },
                  value: {
                    kind: Kind.VARIABLE,
                    name: {
                      kind: Kind.NAME,
                      value: varName,
                    },
                  },
                };
              })
            : undefined,
          selectionSet,
        };
      }

      return {
        kind: Kind.FIELD,
        name: {
          kind: Kind.NAME,
          value: field,
        },
        selectionSet: produceSimpleFieldSet(value, allVars),
      };
    }),
  };
}

export function produceTypeNode(varType: string): TypeNode {
  // non-null (Acme!)
  if (varType[varType.length - 1] === "!") {
    const subType = produceTypeNode(varType.slice(0, -1));
    if (subType.kind === Kind.NON_NULL_TYPE) {
      throw new Error("nested non-null type: " + varType);
    }

    return {
      kind: Kind.NON_NULL_TYPE,
      type: subType,
    };
  }

  // list ([Acme])
  if (varType[0] === "[" && varType[varType.length - 1] === "]") {
    return {
      kind: Kind.LIST_TYPE,
      type: produceTypeNode(varType.slice(1, -1)),
    };
  }

  // name
  return {
    kind: Kind.NAMED_TYPE,
    name: {
      kind: Kind.NAME,
      value: varType,
    },
  };
}
