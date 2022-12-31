import {
  ASTNode,
  Kind,
  OperationTypeNode,
  SelectionSetNode,
  print,
} from "graphql";

import {
  VarDefinition,
  ArgumentsShape,
  FieldDefinition,
  SelectionShape,
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
  Args extends ArgumentsShape,
  Selection extends SelectionShape<MagicNarrowString>,
  MagicNarrowString extends string
>(params: Args, defs: Selection): FieldDefinition<null, Args, Selection>;

export function op<
  OpName extends string,
  Args extends ArgumentsShape,
  Selection extends SelectionShape<MagicNarrowString>,
  MagicNarrowString extends string
>(
  opName: OpName,
  params: Args,
  defs: Selection
): FieldDefinition<OpName, Args, Selection>;

export function op(
  ...args:
    | [string, ArgumentsShape, SelectionShape<string>]
    | [ArgumentsShape, SelectionShape<string>]
) {
  const [opName, params, defs] =
    args.length === 2
      ? ([null, ...args] as [null, ArgumentsShape, SelectionShape<string>])
      : args;

  return { [OP_MARKER]: [opName, params, defs] };
}

export function query<
  Selection extends SelectionShape<MagicNarrowString>,
  MagicNarrowString extends string
>(
  defs: Selection // top level, like anything, can be simple fields, ops, etc
): Runner<Selection> {
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
type VarsForSelectionShape<
  Selection extends SelectionShape<any>,
  Field = keyof Selection
> = Field extends string
  ? Selection[Field] extends string
    ? never
    : Selection[Field] extends FieldDefinition<
        infer OpName,
        infer OpParams,
        infer OpFields
      >
    ? VarAsKeyValue<OpParams[keyof OpParams]> | VarsForSelectionShape<OpFields>
    : VarsForSelectionShape<Selection[Field]>
  : never;

// more evil magic: https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
type UnionToIntersection<Union> = (
  Union extends any ? (k: Union) => void : never
) extends (k: infer Intersection) => void
  ? Intersection
  : never;

export interface Runner<Selection extends SelectionShape<string>> {
  run(
    vars: UnionToIntersection<VarsForSelectionShape<Selection>>
  ): OutputForSelectionShape<Selection>;
}

// utility to infer used variable names from defined query
export type RunnerVars<R extends Runner<SelectionShape<any>>> =
  R extends Runner<infer Selection>
    ? UnionToIntersection<VarsForSelectionShape<Selection>>
    : never;

// interpret the collected query definitions
type OutputForSelectionShape<Selection> = {
  [Field in keyof Selection]: Selection[Field] extends string
    ? FieldTypeMap[Extract<Selection[Field], keyof FieldTypeMap>]
    : Selection[Field] extends FieldDefinition<
        infer OpName,
        any,
        infer OpFields
      >
    ? OutputForSelectionShape<OpFields>
    : OutputForSelectionShape<Selection[Field]>;
};
