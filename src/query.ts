// GraphQL types to JS types
type FieldTypeMap = {
  "String!": string;
  "Number!": number;
  "ID!": string;
};

// variable input definition object
const VAR_MARKER = Symbol("var marker");
type VarDefinition<VarName extends string, VarType extends string> = {
  [VAR_MARKER]: [VarName, VarType];
};

export function input<VarName extends `$${string}`, VarType extends string>(
  varName: VarName,
  varType: VarType
): VarDefinition<VarName, VarType> {
  return {
    [VAR_MARKER]: [varName, varType],
  };
}

// operation params map
interface OpParamDefs {
  [paramName: string]: VarDefinition<string, string>;
}

// operation definition object
const OP_MARKER = Symbol("op marker");
type OpDefinition<
  OpName extends string | null, // null means infer from field name
  Params extends OpParamDefs,
  Defs
> = {
  [OP_MARKER]: [OpName, Params, Defs];
};

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

// using the weird "ask to TS keep strings narrow" trick from:
// https://stackoverflow.com/questions/59440453/dynamically-generate-return-type-based-on-array-parameter-of-objects-in-typescri
// and discussed here: https://github.com/microsoft/TypeScript/issues/30680
type Definitions<MagicNarrowString extends string> = {
  [key: string]:
    | MagicNarrowString
    | Definitions<MagicNarrowString>
    | OpDefinition<
        MagicNarrowString | null,
        OpParamDefs,
        Definitions<MagicNarrowString>
      >;
};

export declare function query<
  Defs extends Definitions<MagicNarrowString>,
  MagicNarrowString extends string
>(
  defs: Defs // top level, like anything, can be simple fields, ops, etc
): Runner<Defs>;

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
