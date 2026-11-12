import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertFailedTransaction,
  assertFunctionTransaction,
  assertRejectedPayment,
  assertSuccessfulTransaction,
  deployContractSha256,
  findEvent,
  normalizeAccessKeys,
} from "../../scripts/lib/factory-v02-acceptance.js";
import {
  parseTransactionHash,
  type FinalTransaction,
} from "../../scripts/lib/factory-v02-live.js";

const hash = "E6332koNKog2W3xai3eNA3sc65fjzymeA3CNQvpWWqfT";

test("parses a transaction hash from ANSI-formatted near-cli output", () => {
  assert.equal(
    parseTransactionHash(`\u001b[32mTransaction ID: ${hash}\u001b[0m`),
    hash,
  );
});

test("verifies a final function call and rejected payment result", () => {
  const transaction = functionTransaction({
    approved: false,
    payment_id: 2,
    reason: "Payment is not due",
    settled: false,
  });
  assertFunctionTransaction(transaction, {
    args: { amount: "1" },
    depositYocto: "0",
    methodName: "request_payment",
    receiverId: "child.clavis.testnet",
    signerId: "agent.testnet",
  });
  const result = assertRejectedPayment(
    assertSuccessfulTransaction(transaction),
    "Payment is not due",
  );
  assert.equal(result.payment_id, 2);
});

test("requires the expected panic message for failed transactions", () => {
  const transaction = functionTransaction(null);
  transaction.status = { Failure: { ActionError: { kind: "Owner authorization required" } } };
  assert.doesNotThrow(() => assertFailedTransaction(transaction, "Owner authorization required"));
  assert.throws(() => assertFailedTransaction(transaction, "different failure"));
});

test("extracts one matching NEP-297 event", () => {
  const transaction = functionTransaction(null);
  transaction.receipts_outcome = [
    {
      outcome: {
        logs: [
          `EVENT_JSON:${JSON.stringify({
            data: [{ payment_id: 1 }],
            event: "payment_decision",
            standard: "clavis",
            version: "1.0.0",
          })}`,
        ],
      },
    },
  ];
  assert.deepEqual(findEvent(transaction, "clavis", "payment_decision").data, [
    { payment_id: 1 },
  ]);
});

test("normalizes access controls without mutable nonces", () => {
  assert.deepEqual(
    normalizeAccessKeys([
      {
        access_key: { nonce: 8, permission: "FullAccess" },
        public_key: "ed25519:z",
      },
      {
        access_key: { nonce: 2, permission: { FunctionCall: { method_names: ["x"] } } },
        public_key: "ed25519:a",
      },
    ]),
    [
      {
        permission: { FunctionCall: { method_names: ["x"] } },
        public_key: "ed25519:a",
      },
      { permission: "FullAccess", public_key: "ed25519:z" },
    ],
  );
});

test("accepts the RPC deployment action's base64-encoded SHA-256 digest", () => {
  const digest = "f64c2d7a8b9ce47c5922c6beb65ac8c579110f6286f2b7aa4b26559b72f7bf39";
  assert.equal(deployContractSha256(Buffer.from(digest, "hex").toString("base64")), digest);
});

function functionTransaction(result: unknown): FinalTransaction {
  return {
    final_execution_status: "FINAL",
    status: {
      SuccessValue: result === null ? "" : Buffer.from(JSON.stringify(result)).toString("base64"),
    },
    transaction: {
      actions: [
        {
          FunctionCall: {
            args: Buffer.from(JSON.stringify({ amount: "1" })).toString("base64"),
            deposit: "0",
            method_name: "request_payment",
          },
        },
      ],
      hash,
      receiver_id: "child.clavis.testnet",
      signer_id: "agent.testnet",
    },
  };
}
