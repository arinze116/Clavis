import { describe, expect, it } from "vitest";

import { assertRestrictedAgentAccessKey } from "./near.js";

describe("assertRestrictedAgentAccessKey", () => {
  it("accepts only request_payment on the intended contract", () => {
    expect(() =>
      assertRestrictedAgentAccessKey(
        {
          permission: {
            FunctionCall: {
              allowance: null,
              receiver_id: "acme.clavis.testnet",
              method_names: ["request_payment"],
            },
          },
        },
        "acme.clavis.testnet",
      ),
    ).not.toThrow();
  });

  it("rejects Full Access keys without an override", () => {
    expect(() =>
      assertRestrictedAgentAccessKey(
        { permission: "FullAccess" },
        "acme.clavis.testnet",
      ),
    ).toThrow("Refusing to start with a Full Access agent key");
  });

  it.each([
    {
      receiver_id: "globex.clavis.testnet",
      method_names: ["request_payment"],
    },
    {
      receiver_id: "acme.clavis.testnet",
      method_names: [],
    },
    {
      receiver_id: "acme.clavis.testnet",
      method_names: ["request_payment", "set_agent"],
    },
  ])("rejects over-broad Function Call permission %#", (permission) => {
    expect(() =>
      assertRestrictedAgentAccessKey(
        {
          permission: {
            FunctionCall: {
              allowance: null,
              ...permission,
            },
          },
        },
        "acme.clavis.testnet",
      ),
    ).toThrow("Agent key must only call request_payment on acme.clavis.testnet");
  });
});
