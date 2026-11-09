import { describe, expect, it } from "vitest";

import type { NearRpcClient } from "./near.js";
import {
  isPayrollOwner,
  pendingOperationMatchesRecipient,
  recipientMatchesExpectedPolicy,
  summarizeTransaction,
} from "./notification-api.js";
import type { PendingPayrollOperation } from "./payroll-plan-store.js";
import type { RecipientView } from "./types.js";

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

describe("isPayrollOwner", () => {
  it("accepts only the owner returned by the payroll contract", async () => {
    const rpc = {
      view: async (contractId: string, methodName: string) => {
        expect(contractId).toBe("acme.clavis.testnet");
        expect(methodName).toBe("get_owner");
        return "owner.testnet";
      },
    } as unknown as NearRpcClient;

    await expect(
      isPayrollOwner(rpc, "acme.clavis.testnet", "owner.testnet"),
    ).resolves.toBe(true);
    await expect(
      isPayrollOwner(rpc, "acme.clavis.testnet", "attacker.testnet"),
    ).resolves.toBe(false);
  });
});

describe("payroll plan reconciliation", () => {
  const recipient: RecipientView = {
    recipient_hash: "a".repeat(64),
    name: "Ada",
    personal_cap: "200",
    active: true,
    preferred_chain: "near",
    preferred_token: "NEAR",
    payment_split: [],
    schedule: "Weekly",
    last_paid: 0,
    next_payment_at: 0,
  };
  const operation: PendingPayrollOperation = {
    operationId: "11111111-1111-4111-8111-111111111111",
    action: "upsert",
    contractId: "acme.clavis.testnet",
    recipientHash: "a".repeat(64),
    recipient: {
      recipientHash: "a".repeat(64),
      name: "Ada",
      nearAddress: "ada.testnet",
      amountYocto: "100",
      milestoneReady: false,
      destinations: [
        {
          chain: "near",
          token: "NEAR",
          address: "ada.testnet",
          percentage: 100,
        },
      ],
    },
    expectedPolicy: {
      name: "Ada",
      personalCapYocto: "200",
      active: true,
      preferredChain: "near",
      preferredToken: "NEAR",
      paymentSplit: [],
      schedule: "Weekly",
    },
    createdAt: "2026-11-09T00:00:00.000Z",
    expiresAt: "2026-11-10T00:00:00.000Z",
  };

  it("promotes an upsert only after every public policy field matches", () => {
    expect(recipientMatchesExpectedPolicy(recipient, operation.expectedPolicy)).toBe(true);
    expect(pendingOperationMatchesRecipient(operation, recipient)).toBe(true);
    expect(
      pendingOperationMatchesRecipient(operation, {
        ...recipient,
        personal_cap: "201",
      }),
    ).toBe(false);
  });

  it("promotes removal only after the recipient is absent", () => {
    const removal: PendingPayrollOperation = {
      operationId: "22222222-2222-4222-8222-222222222222",
      action: "remove",
      contractId: "acme.clavis.testnet",
      recipientHash: "a".repeat(64),
      createdAt: "2026-11-09T00:00:00.000Z",
      expiresAt: "2026-11-10T00:00:00.000Z",
    };
    expect(pendingOperationMatchesRecipient(removal, recipient)).toBe(false);
    expect(pendingOperationMatchesRecipient(removal, null)).toBe(true);
  });
});
