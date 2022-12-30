// scratchpad
import { query, op, qvar, RunnerVars } from "./src/query";

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

const bareVars: RunnerVars<typeof q> = {
  $varA: "asdf",
  $varB: 1234,
  $varC: "cvbxcvb",
};

const a = q.run(bareVars).order.legacyResourceId;
const b = q.run(bareVars).order.shippingAddress.zip;
const c = q.run(bareVars).order.renamedOp;
const d = q.run(bareVars).order.someImplicitOp.value;
