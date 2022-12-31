import { ASTNode, Kind, OperationTypeNode, SelectionSetNode } from "graphql";

// variable input definition object
export const VAR_MARKER = Symbol("var marker");
export type VarDefinition<VarName extends string, VarType extends string> = {
  [VAR_MARKER]: [VarName, VarType];
};

// operation params map
export interface OpParamDefs {
  [paramName: string]: VarDefinition<string, string>;
}

// operation definition object
// @todo rename to args selection or something, and use for aliasing simple fields too
export const OP_MARKER = Symbol("op marker");
export type OpDefinition<
  OpName extends string | null, // null means infer from field name
  Params extends OpParamDefs,
  Defs
> = {
  [OP_MARKER]: [OpName, Params, Defs];
};

// using the weird "ask to TS keep strings narrow" trick from:
// https://stackoverflow.com/questions/59440453/dynamically-generate-return-type-based-on-array-parameter-of-objects-in-typescri
// and discussed here: https://github.com/microsoft/TypeScript/issues/30680
// @todo rename to selection
export type Definitions<MagicNarrowString extends string> = {
  [OP_MARKER]?: undefined; // disambiguation

  [key: string]:
    | MagicNarrowString
    | Definitions<MagicNarrowString>
    | OpDefinition<
        MagicNarrowString | null,
        OpParamDefs,
        Definitions<MagicNarrowString>
      >;
};

function isOp(
  obj: Definitions<string> | OpDefinition<any, any, any>
): obj is OpDefinition<any, any, any> {
  return obj[OP_MARKER] !== undefined;
}

export function produceSimpleFieldSet(
  defs: Definitions<string>
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
