// scratchpad

declare const VAR_MARKER: unique symbol;

type VarDefinition<VarName extends string, VarType extends string> = {
  [VAR_MARKER]: VarName;
  type: VarType;
};

interface OpParamDefs {
  [paramName: string]: VarDefinition<string, string>;
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

declare const OP_MARKER: unique symbol;
type OpDefinition<
  OpName extends string | null,
  Params extends OpParamDefs,
  Defs
> = {
  [OP_MARKER]: Params;
  name: OpName; // null means infer from field name
  output: Defs;
};

declare function op<
  Params extends OpParamDefs,
  Defs extends Definitions<MagicNarrowString>,
  MagicNarrowString extends string
>(params: Params, defs: Defs): OpDefinition<null, Params, Defs>;
declare function op<
  OpName extends string,
  Params extends OpParamDefs,
  Defs extends Definitions<MagicNarrowString>,
  MagicNarrowString extends string
>(
  opName: OpName,
  params: Params,
  defs: Defs
): OpDefinition<OpName, Params, Defs>;

declare function qvar<VarName extends `$${string}`, VarType extends string>(
  varName: VarName,
  varType: VarType
): VarDefinition<VarName, VarType>;

declare function query<
  Defs extends Definitions<MagicNarrowString>,
  MagicNarrowString extends string
>(
  defs: Defs // top level, like anything, can be simple fields, ops, etc
): Runner<Defs>;

type VarsBareNames<Vars> = {
  [T in keyof Vars as T extends `$${infer BareName}`
    ? BareName
    : never]: Vars[T];
};

type VarKeyValue<Def> = Def extends VarDefinition<infer VarName, infer VarType>
  ? { [k in VarName]: VarType }
  : never;

// get a union of { param: type } variable info objects from definitions
type VarsFromDefs<
  Defs extends Definitions<any>,
  Field extends keyof Defs = keyof Defs
> = Defs[Field] extends string
  ? never
  : Defs[Field] extends OpDefinition<
      infer OpName,
      infer OpParams,
      infer OpFields
    >
  ? VarKeyValue<OpParams[keyof OpParams]> | VarsFromDefs<OpFields>
  : VarsFromDefs<Defs[Field]>;

// more evil magic from StackOverflow
type UnionToIntersection<Union> = (
  Union extends any ? (k: Union) => void : never
) extends (k: infer Intersection) => void
  ? Intersection
  : never;

interface Runner<Defs extends Definitions<string>> {
  bareVars: UnionToIntersection<VarsFromDefs<Defs>>;
  run(): RunnerOutput<Defs>;
}

type FieldTypeMap = {
  "String!": string;
  "ID!": string;
};

// interpret the collected query definitions
type RunnerOutput<Defs> = {
  [Field in keyof Defs]: Defs[Field] extends string
    ? FieldTypeMap[Extract<Defs[Field], keyof FieldTypeMap>]
    : Defs[Field] extends OpDefinition<infer OpName, any, infer OpFields>
    ? RunnerOutput<OpFields>
    : RunnerOutput<Defs[Field]>;
};

const q = query({
  order: op(
    { argA: qvar("$varA", "ID!"), argB: qvar("$varB", "Number!") },
    {
      legacyResourceId: "String!",

      shippingAddress: {
        name: "String!",

        address1: "String!",
        address2: "String!",
        city: "String!",
        provinceCode: "String!",
        countryCodeV2: "String!",
        zip: "String!",
      },

      renamedOp: op(
        "metafield",
        { test: qvar("$varC", "String!") },
        {
          value: "String!",
        }
      ),

      someImplicitOp: op(
        { test: qvar("$varC", "String!") },
        {
          value: "String!",
        }
      ),
    }
  ),
});

const vB = q.bareVars.$varB;
const a = q.run().order.legacyResourceId;
const b = q.run().order.shippingAddress.zip;
const c = q.run().order.renamedOp;
const d = q.run().order.someImplicitOp.value;
