import { ASTNode, Kind, OperationTypeNode, SelectionSetNode } from "graphql";

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
// @todo rename to args selection or something, and use for aliasing simple fields too
export const FIELD_MARKER = Symbol("field marker");
export type FieldDefinition<
  Name extends string | null, // null means infer from field name
  Args extends ArgumentsShape,
  Selection
> = {
  [FIELD_MARKER]: [Name, Args, Selection];
};

// using the weird "ask to TS keep strings narrow" trick from:
// https://stackoverflow.com/questions/59440453/dynamically-generate-return-type-based-on-array-parameter-of-objects-in-typescri
// and discussed here: https://github.com/microsoft/TypeScript/issues/30680
// @todo rename to selection
export type SelectionShape<MagicNarrowString extends string> = {
  [FIELD_MARKER]?: undefined; // disambiguation

  [key: string]:
    | MagicNarrowString
    | SelectionShape<MagicNarrowString>
    | FieldDefinition<
        MagicNarrowString | null,
        ArgumentsShape,
        SelectionShape<MagicNarrowString>
      >;
};

function isFieldDef(
  obj: SelectionShape<string> | FieldDefinition<any, any, any>
): obj is FieldDefinition<any, any, any> {
  return obj[FIELD_MARKER] !== undefined;
}

export function produceSimpleFieldSet(
  selection: SelectionShape<string>
): SelectionSetNode {
  return {
    kind: Kind.SELECTION_SET,
    selections: Object.keys(selection).map((field) => {
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
          arguments: Object.keys(args).map((argKey) => {
            const param = args[argKey];
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
                  value: param[VAR_MARKER][0],
                },
              },
            };
          }),
          selectionSet: produceSimpleFieldSet(subSelection),
        };
      }

      return {
        kind: Kind.FIELD,
        name: {
          kind: Kind.NAME,
          value: field,
        },
        selectionSet: produceSimpleFieldSet(value),
      };
    }),
  };
}
