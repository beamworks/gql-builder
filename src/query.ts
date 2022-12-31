import {
  ASTNode,
  Kind,
  OperationTypeNode,
  SelectionSetNode,
  print,
} from "graphql";

import {
  VarDefinition,
  OpParamDefs,
  OpDefinition,
  Definitions,
  VAR_MARKER,
  OP_MARKER,
  produceSimpleFieldSet,
} from "./ast";

// GraphQL types to JS types
type FieldTypeMap = {
  "String!": string;
  "Number!": number;
  "ID!": string;
};

function sliceVarPrefix<A extends string>(a: `$${A}`): A {
  if (a[0] !== "$") {
    throw new Error("var should be prefixed with $");
  }

  return a.slice(1) as A;
}

export function input<VarName extends string, VarType extends string>(
  varNameWithPrefix: `$${VarName}`,
  varType: VarType
): VarDefinition<VarName, VarType> {
  return {
    [VAR_MARKER]: [sliceVarPrefix<VarName>(varNameWithPrefix), varType],
  };
}

// convenience variations with and without explicit op name
export function op<
  Params extends OpParamDefs,
  Defs extends Definitions<MagicNarrowString>,
  MagicNarrowString extends string
>(params: Params, defs: Defs): OpDefinition<null, Params, Defs>;

export function op<
  OpName extends string,
  Params extends OpParamDefs,
  Defs extends Definitions<MagicNarrowString>,
  MagicNarrowString extends string
>(
  opName: OpName,
  params: Params,
  defs: Defs
): OpDefinition<OpName, Params, Defs>;

export function op(
  ...args:
    | [string, OpParamDefs, Definitions<string>]
    | [OpParamDefs, Definitions<string>]
) {
  const [opName, params, defs] =
    args.length === 2
      ? ([null, ...args] as [null, OpParamDefs, Definitions<string>])
      : args;

  return { [OP_MARKER]: [opName, params, defs] };
}

export function query<
  Defs extends Definitions<MagicNarrowString>,
  MagicNarrowString extends string
>(
  defs: Defs // top level, like anything, can be simple fields, ops, etc
): Runner<Defs> {
  const testAST: ASTNode = {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: OperationTypeNode.QUERY,
        selectionSet: produceSimpleFieldSet(defs),
      },
    ],
  };

  console.log("printed query:", print(testAST));

  return {
    run() {
      throw new Error("not implemented");
    },
  };
}

// type VarsBareNames<Vars> = {
//   [T in keyof Vars as T extends `$${infer BareName}`
//     ? BareName
//     : never]: Vars[T];
// };

// present a known variable as type { [varName]: varType }
type VarAsKeyValue<Def> = Def extends VarDefinition<
  infer VarName,
  infer VarType
>
  ? { [k in VarName]: FieldTypeMap[Extract<VarType, keyof FieldTypeMap>] }
  : never;

// get a union of { param: type } variable info objects from definitions
// (note: `Field extends string` ternary seems to be required, otherwise recursion fails
type VarsForDefs<
  Defs extends Definitions<any>,
  Field = keyof Defs
> = Field extends string
  ? Defs[Field] extends string
    ? never
    : Defs[Field] extends OpDefinition<
        infer OpName,
        infer OpParams,
        infer OpFields
      >
    ? VarAsKeyValue<OpParams[keyof OpParams]> | VarsForDefs<OpFields>
    : VarsForDefs<Defs[Field]>
  : never;

// more evil magic: https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
type UnionToIntersection<Union> = (
  Union extends any ? (k: Union) => void : never
) extends (k: infer Intersection) => void
  ? Intersection
  : never;

export interface Runner<Defs extends Definitions<string>> {
  run(vars: UnionToIntersection<VarsForDefs<Defs>>): OutputForDefs<Defs>;
}

// utility to infer used variable names from defined query
export type RunnerVars<R extends Runner<Definitions<any>>> = R extends Runner<
  infer Defs
>
  ? UnionToIntersection<VarsForDefs<Defs>>
  : never;

// interpret the collected query definitions
type OutputForDefs<Defs> = {
  [Field in keyof Defs]: Defs[Field] extends string
    ? FieldTypeMap[Extract<Defs[Field], keyof FieldTypeMap>]
    : Defs[Field] extends OpDefinition<infer OpName, any, infer OpFields>
    ? OutputForDefs<OpFields>
    : OutputForDefs<Defs[Field]>;
};
