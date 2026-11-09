import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapPaymentDecisionTransactions,
  paymentDecisionIds,
  type FinalTransactionOutcome,
} from "../../frontend/src/utils/audit-transactions.ts";

const contractId = "acme.clavis.testnet";

function outcome(hash: string, paymentIds: number[]): FinalTransactionOutcome {
  return {
    transaction: { hash },
    receipts_outcome: [
      {
        outcome: {
          executor_id: contractId,
          logs: paymentIds.map(
            (paymentId) =>
              `EVENT_JSON:${JSON.stringify({
                standard: "clavis",
                version: "1.0.0",
                event: "payment_decision",
                data: [{ payment_id: paymentId }],
              })}`,
          ),
        },
      },
    ],
  };
}

describe("audit transaction event mapping", () => {
  it("maps same-block decisions by emitted payment ID instead of array order", () => {
    const mapped = mapPaymentDecisionTransactions(
      [outcome("transaction-b", [42]), outcome("transaction-a", [41])],
      contractId,
    );

    assert.equal(mapped.get(41), "transaction-a");
    assert.equal(mapped.get(42), "transaction-b");
  });

  it("maps all five security-audit entries to their exact transaction", () => {
    const mapped = mapPaymentDecisionTransactions(
      [outcome("security-audit-transaction", [5, 6, 7, 8, 9])],
      contractId,
    );

    assert.deepEqual(
      [...mapped.entries()],
      [5, 6, 7, 8, 9].map((paymentId) => [paymentId, "security-audit-transaction"]),
    );
  });

  it("ignores malformed events and logs emitted by another contract", () => {
    const value: FinalTransactionOutcome = {
      transaction: { hash: "transaction" },
      receipts_outcome: [
        { outcome: { executor_id: contractId, logs: ["EVENT_JSON:not-json"] } },
        {
          outcome: {
            executor_id: "other.testnet",
            logs: outcome("ignored", [10]).receipts_outcome?.[0]?.outcome?.logs,
          },
        },
      ],
    };

    assert.deepEqual(paymentDecisionIds(value, contractId), []);
  });
});
