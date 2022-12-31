import { GraphQLClient } from "graphql-request";
import { VariablesOf } from "@graphql-typed-document-node/core";

import { query, select, alias, input } from "./src/query";

// scratchpad
const q = query({
  order: select(
    { argA: input("$varA", "ID!"), argB: input("$varB", "Number!") },
    {
      legacyResourceId: "String!",

      shippingAddress: {
        name: "String!",

        address1: "String!",
        address2: "String!",
        city: "String!",
        provinceCode: "String!",
        countryCode: alias("countryCodeV2", "String!"),
        zip: "String!",
      },

      total: alias("discountedPriceTotal", {
        amount: "Number!",
        currencyCode: "String!",
      }),

      renamedOp: select(
        "metafield",
        { test: input("$varC", "String!") },
        {
          value: "String!",
        }
      ),

      someImplicitOp: select(
        { test: input("$varC", "String!") },
        {
          value: "String!",
        }
      ),
    }
  ),
});

const gqlClient = new GraphQLClient("http://example.com");

const bareVars: VariablesOf<typeof q> = {
  varA: "asdf",
  varB: 1234,
  varC: "cvbxcvb",
};

gqlClient.request(q, bareVars).then((result) => {
  const a = result.order.legacyResourceId;
  const b = result.order.shippingAddress.zip;
  const b1 = result.order.shippingAddress.countryCode;
  const b2 = result.order.total.amount;
  const c = result.order.renamedOp;
  const d = result.order.someImplicitOp.value;
});
