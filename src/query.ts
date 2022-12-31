import {
  ASTNode,
  Kind,
  OperationTypeNode,
  SelectionSetNode,
  VariableDefinitionNode,
  print,
} from "graphql";

import {
  VarDefinition,
  ArgumentsShape,
  FieldDefinition,
  SelectionShape,
  VAR_MARKER,
  FIELD_MARKER,
  produceSimpleFieldSet,
  produceTypeNode,
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

// convenience variations with and without explicit "real" field name
export function select<
  Args extends ArgumentsShape,
  Selection extends SelectionShape<MagicNarrowString>,
  MagicNarrowString extends string
>(args: Args, selection: Selection): FieldDefinition<null, Args, Selection>;

export function select<
  Name extends string,
  Args extends ArgumentsShape,
  Selection extends SelectionShape<MagicNarrowString>,
  MagicNarrowString extends string
>(
  name: Name,
  args: Args,
  selection: Selection
): FieldDefinition<Name, Args, Selection>;

export function select(
  ...selectArgs:
    | [string, ArgumentsShape, SelectionShape<string>]
    | [ArgumentsShape, SelectionShape<string>]
) {
  const [name, args, selection] =
    selectArgs.length === 2
      ? ([null, ...selectArgs] as [
          null,
          ArgumentsShape,
          SelectionShape<string>
        ])
      : selectArgs;

  return { [FIELD_MARKER]: [name, args, selection] };
}

// same as select() but without arguments
export function alias<
  Name extends string,
  Selection extends SelectionShape<string> | string
>(
  realFieldName: Name,
  fieldType: Selection
): FieldDefinition<Name, null, Selection> {
  return { [FIELD_MARKER]: [realFieldName, null, fieldType] };
}

// @todo produce the AST asynchronously
export function query<
  Selection extends SelectionShape<MagicNarrowString>,
  MagicNarrowString extends string
>(
  defs: Selection // top level, like anything, can be simple fields, selections with arguments, etc
): Runner<Selection> {
  const allVars: { [name: string]: string } = {};
  const rootSelectionSet = produceSimpleFieldSet(defs, allVars);

  const varList = Object.keys(allVars);
  const rootVars =
    varList.length > 0
      ? varList.map((varName): VariableDefinitionNode => {
          const varType = allVars[varName];

          return {
            kind: Kind.VARIABLE_DEFINITION,
            variable: {
              kind: Kind.VARIABLE,
              name: {
                kind: Kind.NAME,
                value: varName,
              },
            },
            type: produceTypeNode(varType),
          };
        })
      : undefined;

  const testAST: ASTNode = {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: OperationTypeNode.QUERY,
        variableDefinitions: rootVars,
        selectionSet: rootSelectionSet,
      },
    ],
  };

  console.log("printed query:", print(testAST));

  return {
    async run() {
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
  ? Selection[Field] extends FieldDefinition<
      any,
      infer FieldArgs,
      infer FieldSubSelection
    >
    ? VarsForField<FieldArgs, FieldSubSelection>
    : VarsForSelectionShape<Selection[Field]>
  : never;

type VarsForField<
  Args extends ArgumentsShape | null,
  Selection
> = Selection extends string
  ? never
  : VarAsKeyValue<Args[keyof Args]> | VarsForSelectionShape<Selection>;

// more evil magic: https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
type UnionToIntersection<Union> = (
  Union extends any ? (k: Union) => void : never
) extends (k: infer Intersection) => void
  ? Intersection
  : never;

export interface Runner<Selection extends SelectionShape<string>> {
  run(
    vars: UnionToIntersection<VarsForSelectionShape<Selection>>
  ): Promise<OutputForSelectionShape<Selection>>;
}

// utility to infer used variable names from defined query
export type RunnerVars<R extends Runner<SelectionShape<any>>> =
  R extends Runner<infer Selection>
    ? UnionToIntersection<VarsForSelectionShape<Selection>>
    : never;

// interpret the collected query definitions
type OutputForSelectionShape<Selection> = {
  [Field in keyof Selection]: Selection[Field] extends FieldDefinition<
    any,
    any,
    infer FieldSubSelection
  >
    ? OutputForField<FieldSubSelection>
    : OutputForField<Selection[Field]>;
};

type OutputForField<Selection> = Selection extends string
  ? FieldTypeMap[Extract<Selection, keyof FieldTypeMap>]
  : OutputForSelectionShape<Selection>;
