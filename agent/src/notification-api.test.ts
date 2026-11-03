import { describe, expect, it } from "vitest";

import { summarizeTransaction } from "./notification-api.js";

function encodedArgs(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

describe("summarizeTransaction", () => {
  it("identifies worker creation transactions and includes worker names", () => {
    const summary = summarizeTransaction({
      status: { SuccessValue: "" },
      transaction: {
        hash: "transaction-hash",
        signer_id: "owner.testnet",
        receiver_id: "acme.clavis.testnet",
        actions: [
          {
            FunctionCall: {
              method_name: "add_recipient",
              args: encodedArgs({ config: { name: "Ada" } }),
            },
          },
          {
            FunctionCall: {
              method_name: "add_recipient",
              args: encodedArgs({ config: { name: "Chidi" } }),
            },
          },
        ],
      },
    });

    expect(summary).toEqual({
      label: "2 workers added",
      methodNames: ["add_recipient", "add_recipient"],
      details: ["Ada", "Chidi"],
      succeeded: true,
    });
  });

  it("marks failed policy updates as failed alerts", () => {
    const summary = summarizeTransaction({
      status: { Failure: { ActionError: {} } },
      transaction: {
        hash: "transaction-hash",
        signer_id: "owner.testnet",
        receiver_id: "acme.clavis.testnet",
        actions: [
          {
            FunctionCall: {
              method_name: "update_limits",
              args: encodedArgs({ daily: "10", per_payment: "5" }),
            },
          },
        ],
      },
    });

    expect(summary.label).toBe("Payroll limits updated");
    expect(summary.succeeded).toBe(false);
  });
});
