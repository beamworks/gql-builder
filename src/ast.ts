import { ASTNode, Kind, OperationTypeNode, SelectionSetNode } from "graphql";

// variable input definition object
export const VAR_MARKER = Symbol("var marker");
export type VarDefinition<VarName extends string, VarType extends string> = {
  [VAR_MARKER]: [VarName, VarType];
};

// operation params map
export interface ArgumentsShape {
  [paramName: string]: VarDefinition<string, string>;
}

// operation definition object
// @todo rename to args selection or something, and use for aliasing simple fields too
export const OP_MARKER = Symbol("op marker");
export type FieldDefinition<
  Name extends string | null, // null means infer from field name
  Args extends ArgumentsShape,
  Selection
> = {
  [OP_MARKER]: [Name, Args, Selection];
};

// using the weird "ask to TS keep strings narrow" trick from:
// https://stackoverflow.com/questions/59440453/dynamically-generate-return-type-based-on-array-parameter-of-objects-in-typescri
// and discussed here: https://github.com/microsoft/TypeScript/issues/30680
// @todo rename to selection
export type SelectionShape<MagicNarrowString extends string> = {
  [OP_MARKER]?: undefined; // disambiguation

  [key: string]:
    | MagicNarrowString
    | SelectionShape<MagicNarrowString>
    | FieldDefinition<
        MagicNarrowString | null,
        ArgumentsShape,
        SelectionShape<MagicNarrowString>
      >;
};

function isOp(
  obj: SelectionShape<string> | FieldDefinition<any, any, any>
): obj is FieldDefinition<any, any, any> {
  return obj[OP_MARKER] !== undefined;
}

export function produceSimpleFieldSet(
  defs: SelectionShape<string>
): SelectionSetNode {
  return {
    kind: Kind.SELECTION_SET,
    selections: Object.keys(defs).map((field) => {
      const value = defs[field];

      if (typeof value === "string") {
        return {
          kind: Kind.FIELD,
          name: {
            kind: Kind.NAME,
            value: field,
          },
        };
      }

      if (isOp(value)) {
        const [opName, params, defs] = value[OP_MARKER];

        return {
          kind: Kind.FIELD,
          name: {
            kind: Kind.NAME,
            value: opName === null ? field : opName,
          },
          alias:
            opName === null
              ? undefined
              : {
                  kind: Kind.NAME,
                  value: field,
                },
          arguments: Object.keys(params).map((paramKey) => {
            const param = params[paramKey];
            return {
              kind: Kind.ARGUMENT,
              name: {
                kind: Kind.NAME,
                value: paramKey,
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
          selectionSet: produceSimpleFieldSet(defs),
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
