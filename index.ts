// scratchpad

interface OpParamDefs<MagicNarrowString extends string> {
  [paramName: string]: MagicNarrowString;
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
        OpParamDefs<MagicNarrowString>,
        Definitions<MagicNarrowString>
      >;
};

declare const OP_MARKER: unique symbol;
type OpDefinition<
  OpName extends string | null,
  Params extends Record<string, string>,
  Defs
> = {
  [OP_MARKER]: Params;
  name: OpName; // null means infer from field name
  output: Defs;
};

declare function op<
  Params extends OpParamDefs<MagicNarrowString>,
  Defs extends Definitions<MagicNarrowString>,
  MagicNarrowString extends string
>(params: Params, defs: Defs): OpDefinition<null, Params, Defs>;
declare function op<
  OpName extends string,
  Params extends OpParamDefs<MagicNarrowString>,
  Defs extends Definitions<MagicNarrowString>,
  MagicNarrowString extends string
>(
  opName: OpName,
  params: Params,
  defs: Defs
): OpDefinition<OpName, Params, Defs>;

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

// interpret the collected query definitions
type VarsFromDefs<
  Defs extends Definitions<any>,
  Field extends keyof Defs = keyof Defs
> = Field extends string
  ? Defs[Field] extends string
    ? never
    : Defs[Field] extends OpDefinition<
        infer OpName,
        infer OpParams,
        infer OpFields
      >
    ? [OpParams[keyof OpParams], ""] | VarsFromDefs<OpFields>
    : VarsFromDefs<Defs[Field]>
  : never;

interface Runner<Defs> {
  bareVars: VarsFromDefs<Defs>;
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
    { argA: "$varA" },
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
        { test: "$varC" },
        {
          value: "String!",
        }
      ),

      someImplicitOp: op(
        { test: "$varC" },
        {
          value: "String!",
        }
      ),
    }
  ),
});

const vA = q.bareVars;
const a = q.run().order.legacyResourceId;
const b = q.run().order.shippingAddress.zip;
const c = q.run().order.renamedOp;
const d = q.run().order.someImplicitOp.value;
