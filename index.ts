// scratchpad

interface ParamsUsingVars<Vars> {
  [paramName: string]: keyof Vars;
}

// using the weird "ask to TS keep strings narrow" trick from:
// https://stackoverflow.com/questions/59440453/dynamically-generate-return-type-based-on-array-parameter-of-objects-in-typescri
// and discussed here: https://github.com/microsoft/TypeScript/issues/30680
type Definitions<Vars, MagicNarrowString extends string> = {
  [key: string]:
    | MagicNarrowString
    | Definitions<Vars, MagicNarrowString>
    | OpDefinition<
        Vars,
        MagicNarrowString | null,
        Definitions<Vars, MagicNarrowString>
      >;
};

declare const OP_MARKER: unique symbol;
type OpDefinition<Vars, OpName extends string | null, Defs> = {
  [OP_MARKER]: ParamsUsingVars<Vars>;
  name: OpName; // null means infer from field name
  output: Defs;
};

declare function op<
  Vars,
  Defs extends Definitions<Vars, MagicNarrowString>,
  MagicNarrowString extends string
>(params: ParamsUsingVars<Vars>, defs: Defs): OpDefinition<Vars, null, Defs>;
declare function op<
  Vars,
  OpName extends string,
  Defs extends Definitions<Vars, MagicNarrowString>,
  MagicNarrowString extends string
>(
  opName: OpName,
  params: ParamsUsingVars<Vars>,
  defs: Defs
): OpDefinition<Vars, OpName, Defs>;

declare function withVars<
  Vars extends { [key in `$${string}`]: MagicNarrowString },
  MagicNarrowString extends string
>(vars: Vars): Builder<Vars>;

interface Builder<Vars> {
  query<
    Defs extends Definitions<Vars, MagicNarrowString>,
    MagicNarrowString extends string
  >(
    defs: Defs // top level, like anything, can be simple fields, ops, etc
  ): Runner<Vars, Defs>;
}

type VarsBareNames<Vars> = {
  [T in keyof Vars as T extends `$${infer BareName}`
    ? BareName
    : never]: Vars[T];
};

interface Runner<Vars, Defs> {
  bareVars: VarsBareNames<Vars>;
  fields: RunnerFields<Defs>;
}

// interpret the collected query definitions
type RunnerFields<Defs> = {
  [Field in keyof Defs]: Defs[Field] extends string
    ? { type: Defs[Field] }
    : Defs[Field] extends OpDefinition<any, infer OpName, infer OpFields>
    ? {
        opName: OpName extends string ? OpName : Field;
        opFields: RunnerFields<OpFields>;
      }
    : { fields: RunnerFields<Defs[Field]> };
};

const q = withVars({
  $varA: 'ID!',
  $varB: 'String!',
  $varC: 'String!',
}).query({
  order: op(
    { argA: '$varA' },
    {
      legacyResourceId: 'String!',

      shippingAddress: {
        name: 'String!',

        address1: 'String!',
        address2: 'String!',
        city: 'String!',
        provinceCode: 'String!',
        countryCodeV2: 'String!',
        zip: 'String!',
      },

      renamedOp: op(
        'metafield',
        { test: '$varC' },
        {
          value: 'String!',
        }
      ),

      someImplicitOp: op(
        { test: '$varC' },
        {
          value: 'String!',
        }
      ),
    }
  ),
});

const vA = q.bareVars.varA;
const a = q.fields.order.opFields.legacyResourceId.type;
const b = q.fields.order.opFields.shippingAddress.fields.zip.type;
const c = q.fields.order.opFields.renamedOp.opFields;
const d = q.fields.order.opFields.someImplicitOp.opName;
