import { describe, expect, it } from "vitest";

import {
  assertContractControlledSettlementVersion,
  assertRestrictedAgentAccessKey,
} from "./near.js";

describe("assertContractControlledSettlementVersion", () => {
  it.each(["0.2.0", "0.3.0", "1.0.0"])("accepts settlement-capable version %s", (version) => {
    expect(() => assertContractControlledSettlementVersion(version)).not.toThrow();
  });

  it.each(["0.1.0", "0.0.9"])("rejects legacy authorization-only version %s", (version) => {
    expect(() => assertContractControlledSettlementVersion(version)).toThrow(
      "v0.2.0 or newer is required",
    );
  });

  it.each(["", "v0.2.0", "0.2", "0.2.0-beta"])("rejects invalid version %j", (version) => {
    expect(() => assertContractControlledSettlementVersion(version)).toThrow(
      "returned an invalid version",
    );
  });
});

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
