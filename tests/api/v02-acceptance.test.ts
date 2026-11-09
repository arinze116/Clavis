import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseRecoveredFailedTransferEvidence,
  recoveredUnauthorizedTransactionIdentity,
  verifyRecoveredFailedTransfer,
  verifyRecoveredUnauthorizedTransaction,
  waitForFinalState,
  type FinalTransactionOutcome,
} from "../../scripts/lib/v02-acceptance.js";

const transactionHash = "8V6x9ZtCnqyh8B43sn5ty5f4gdSwfV8GMA2JjZG7BedB";
const agentAccountId = "clavis-agent.testnet";
const contractId = "clavis.testnet";
const failureAccountId = "clavis-failed-transfer-probe.testnet";
const failureHash = "6f8902e3cfbde824abb56800a37ac662991179197539c82d1782193fa5d796d2";
const amountYocto = "1000000000000000000000";
const reason = "Native NEAR transfer failed";
const paymentResult = {
  approved: false,
  payment_id: 11,
  reason,
  settled: false,
};
const successValue = Buffer.from(JSON.stringify(paymentResult)).toString("base64");

test("waits until the expected final state is visible", async () => {
  let calls = 0;
  const state = await waitForFinalState({
    describe: "test state",
    intervalMs: 0,
    maxAttempts: 3,
    pause: async () => undefined,
    load: async () => ({ count: ++calls }),
    isExpected: (candidate) => candidate.count === 3,
  });

  assert.deepEqual(state, { count: 3 });
  assert.equal(calls, 3);
});

test("stops after the bounded number of final-state attempts", async () => {
  let calls = 0;
  await assert.rejects(
    waitForFinalState({
      describe: "missing state",
      intervalMs: 0,
      maxAttempts: 2,
      pause: async () => undefined,
      load: async () => ({ count: ++calls }),
      isExpected: () => false,
    }),
    /missing state was not visible after 2 final-state attempts/u,
  );
  assert.equal(calls, 2);
});

test("verifies recovered failed-transfer evidence against the final transaction event", () => {
  const evidence = parseRecoveredFailedTransferEvidence(recoveredEvidence());
  const verified = verifyRecoveredFailedTransfer(evidence, finalTransaction(), expectations());

  assert.equal(verified.transactionHash, transactionHash);
  assert.deepEqual(verified.result, { ...paymentResult, transaction_hash: transactionHash });
  assert.deepEqual(verified.decision, {
    block_height: 276954780,
    outcome: { Rejected: reason },
    payment_id: 11,
    timestamp: 1794247624,
  });
});

test("rejects recovered evidence when transaction arguments were changed", () => {
  const transaction = finalTransaction();
  const action = transaction.transaction?.actions?.[0]?.FunctionCall;
  assert.ok(action);
  action.args = Buffer.from(
    JSON.stringify({
      recipient_hash: failureHash,
      amount: "1",
      chain: "near",
      token: "NEAR",
      recipient_account_id: failureAccountId,
    }),
  ).toString("base64");

  assert.throws(
    () =>
      verifyRecoveredFailedTransfer(
        parseRecoveredFailedTransferEvidence(recoveredEvidence()),
        transaction,
        expectations(),
      ),
    /arguments do not match the probe/u,
  );
});

test("rejects recovered evidence without the exact payment-decision event", () => {
  const transaction = finalTransaction();
  const logs = transaction.receipts_outcome?.[0]?.outcome?.logs;
  assert.ok(logs);
  logs.length = 0;

  assert.throws(
    () =>
      verifyRecoveredFailedTransfer(
        parseRecoveredFailedTransferEvidence(recoveredEvidence()),
        transaction,
        expectations(),
      ),
    /exactly one matching decision/u,
  );
});

test("verifies a recovered unauthorized probe without submitting another transaction", () => {
  const evidence = recoveredInitialEvidence();
  const identity = recoveredUnauthorizedTransactionIdentity(evidence);
  const verified = verifyRecoveredUnauthorizedTransaction(
    evidence,
    finalUnauthorizedTransaction(),
    unauthorizedExpectations(),
  );

  assert.deepEqual(identity, {
    sender: "arinze-worker1.testnet",
    transactionHash: "GZCDKytgEsvHYYVhCpGYnj4wGcg71PfWHVnbTGXTYLiq",
  });
  assert.deepEqual(verified.result, {
    approved: false,
    payment_id: 0,
    reason: "Unauthorized caller",
    settled: false,
    transaction_hash: identity.transactionHash,
  });
});

test("rejects a recovered unauthorized probe that emitted a payment decision", () => {
  const transaction = finalUnauthorizedTransaction();
  transaction.receipts_outcome = finalTransaction().receipts_outcome;

  assert.throws(
    () =>
      verifyRecoveredUnauthorizedTransaction(
        recoveredInitialEvidence(),
        transaction,
        unauthorizedExpectations(),
      ),
    /unexpectedly emitted a payment decision/u,
  );
});

function recoveredEvidence(): unknown {
  return {
    captured_at: "2026-11-09T18:08:57.048Z",
    network: "testnet",
    rpc_url: "https://rpc.testnet.near.org",
    transaction_hash: transactionHash,
    sender: agentAccountId,
    final_execution_status: "FINAL",
    status: { SuccessValue: successValue },
    decision: {
      block_height: 276954780,
      outcome: { Rejected: reason },
      payment_id: 11,
      timestamp: 1794247624,
    },
    current: {
      log_count: 11,
      daily_spent: "0",
      pending_recovery_at: null,
      probe_recipient: null,
    },
  };
}

function finalTransaction(): FinalTransactionOutcome {
  return {
    final_execution_status: "FINAL",
    status: { SuccessValue: successValue },
    transaction: {
      hash: transactionHash,
      signer_id: agentAccountId,
      receiver_id: contractId,
      actions: [
        {
          FunctionCall: {
            args: Buffer.from(
              JSON.stringify({
                recipient_hash: failureHash,
                amount: amountYocto,
                chain: "near",
                token: "NEAR",
                recipient_account_id: failureAccountId,
              }),
            ).toString("base64"),
            deposit: "0",
            method_name: "request_payment",
          },
        },
      ],
    },
    receipts_outcome: [
      {
        outcome: {
          executor_id: contractId,
          logs: [
            `EVENT_JSON:${JSON.stringify({
              data: [
                {
                  block_height: 276954780,
                  outcome: { Rejected: reason },
                  payment_id: 11,
                  timestamp: 1794247624,
                },
              ],
              event: "payment_decision",
              standard: "clavis",
              version: "1.0.0",
            })}`,
          ],
        },
      },
    ],
  };
}

function expectations() {
  return {
    agentAccountId,
    amountYocto,
    contractId,
    failureAccountId,
    failureHash,
    reason,
  };
}

function recoveredInitialEvidence(): unknown {
  const result = Buffer.from(
    JSON.stringify({
      approved: false,
      payment_id: 0,
      reason: "Unauthorized caller",
      settled: false,
    }),
  ).toString("base64");
  return {
    network: "testnet",
    transactions: {
      unauthorized_worker_request: {
        hash: "GZCDKytgEsvHYYVhCpGYnj4wGcg71PfWHVnbTGXTYLiq",
        sender: "arinze-worker1.testnet",
        final_execution_status: "FINAL",
        status: { SuccessValue: result },
      },
    },
  };
}

function finalUnauthorizedTransaction(): FinalTransactionOutcome {
  const result = Buffer.from(
    JSON.stringify({
      approved: false,
      payment_id: 0,
      reason: "Unauthorized caller",
      settled: false,
    }),
  ).toString("base64");
  return {
    final_execution_status: "FINAL",
    status: { SuccessValue: result },
    transaction: {
      hash: "GZCDKytgEsvHYYVhCpGYnj4wGcg71PfWHVnbTGXTYLiq",
      signer_id: "arinze-worker1.testnet",
      receiver_id: contractId,
      actions: [
        {
          FunctionCall: {
            args: Buffer.from(
              JSON.stringify({
                amount: amountYocto,
                chain: "near",
                recipient_account_id: "arinze-worker1.testnet",
                recipient_hash:
                  "08ef5e4511a129f31e1ebb73e6b45181c8d335b73af63fdaac9fb63d55c349b6",
                token: "NEAR",
              }),
            ).toString("base64"),
            deposit: "0",
            method_name: "request_payment",
          },
        },
      ],
    },
    receipts_outcome: [],
  };
}

function unauthorizedExpectations() {
  return {
    amountYocto,
    contractId,
    reason: "Unauthorized caller",
    recipientHash: "08ef5e4511a129f31e1ebb73e6b45181c8d335b73af63fdaac9fb63d55c349b6",
    workerAccountId: "arinze-worker1.testnet",
  };
}
