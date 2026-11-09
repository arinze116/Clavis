import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { keyStores, KeyPair, Near } from "near-api-js";

import { AgentCredentialProvider } from "../agent/src/agent-credentials.js";
import { NearClient, NearRpcClient } from "../agent/src/near.js";
import {
  parseRecoveredFailedTransferEvidence,
  recoveredUnauthorizedTransactionIdentity,
  verifyRecoveredFailedTransfer,
  verifyRecoveredUnauthorizedTransaction,
  waitForFinalState,
  type FinalTransactionOutcome,
} from "./lib/v02-acceptance.js";

const allowedRpcUrls = new Set([
  "https://rpc.testnet.near.org",
  "https://rpc.testnet.fastnear.com",
  "https://archival-rpc.testnet.fastnear.com",
]);
const rpcUrl = (process.env.NEAR_RPC_URL ?? "https://rpc.testnet.near.org").replace(/\/$/u, "");
const contractId = "clavis.testnet";
const agentAccountId = "clavis-agent.testnet";
const workerOneId = "arinze-worker1.testnet";
const workerTwoId = "arinze-worker2.testnet";
const failureAccountId = "clavis-failed-transfer-probe.testnet";
const workerOneHash = "08ef5e4511a129f31e1ebb73e6b45181c8d335b73af63fdaac9fb63d55c349b6";
const workerTwoHash = "588e9a3baf6c8287cd594e9370602f4b070d3f6433a6ab55aa9889dc7a84b2ed";
const failureHash = "6f8902e3cfbde824abb56800a37ac662991179197539c82d1782193fa5d796d2";
const unknownHash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const credentialPath =
  process.env.AGENT_CREDENTIALS_PATH ??
  "/opt/clavis/agent/config/agent-credentials.local.json";
const evidenceDirectory =
  process.env.CLAVIS_ACCEPTANCE_EVIDENCE_DIRECTORY ??
  path.join(
    process.env.CLAVIS_BASELINE_DIRECTORY ??
      "/home/ubuntu/.local/state/clavis-v02-20261109",
    "execution",
  );
const phase = process.argv[2] ?? "snapshot";

if (!allowedRpcUrls.has(rpcUrl)) {
  throw new Error(`Refusing unrecognised Testnet RPC endpoint: ${rpcUrl}`);
}
for (const accountId of [contractId, agentAccountId, workerOneId, workerTwoId, failureAccountId]) {
  if (!accountId.endsWith(".testnet")) throw new Error(`Refusing non-Testnet account: ${accountId}`);
}
if (
  new Date().getUTCHours() < 6 &&
  phase !== "snapshot" &&
  phase !== "recovered-failed-transfer" &&
  phase !== "recovered-unauthorized"
) {
  throw new Error("Payment acceptance scenarios run only during the contract's 06:00–24:00 UTC window");
}

const rpc = new NearRpcClient(rpcUrl);
const status = await rpc.jsonRpc<{ chain_id: string }>("status", []);
if (status.chain_id !== "testnet") throw new Error(`Refusing unexpected chain: ${status.chain_id}`);

const credentials = await AgentCredentialProvider.load({ credentialPath });
const credential = credentials.resolve(contractId);
if (credential.accountId !== agentAccountId) {
  throw new Error(`Expected ${agentAccountId}, received ${credential.accountId}`);
}
const near = new NearClient({
  networkId: "testnet",
  rpcUrl,
  accountId: credential.accountId,
  privateKey: credential.privateKey,
  contractId,
});
await near.connect();
const version = await near.verifyContractVersion();
await near.verifyAgentKey();

const evidence: Record<string, unknown> = {
  captured_at: new Date().toISOString(),
  phase,
  network: "testnet",
  rpc_url: rpcUrl,
  contract_id: contractId,
  contract_version: version,
  agent_account_id: credential.accountId,
};

switch (phase) {
  case "snapshot": {
    evidence.snapshot = await snapshot();
    break;
  }
  case "failed-transfer": {
    await assertAccountMissing(failureAccountId);
    const before = await scenarioState(failureHash, failureAccountId);
    const result = await near.requestPayment({
      recipientHash: failureHash,
      recipientAccountId: failureAccountId,
      amountYocto: "1000000000000000000000",
      chain: "near",
      token: "NEAR",
    });
    assertRejected(result, "Native NEAR transfer failed");
    const after = await waitForFinalState({
      describe: "Failed-transfer rollback state",
      load: () => scenarioState(failureHash, failureAccountId),
      isExpected: (state) =>
        state.logCount === before.logCount + 1 &&
        state.dailySpent === before.dailySpent &&
        state.lastPaid === before.lastPaid &&
        state.pendingRecoveryAt === null &&
        state.targetBalance === null,
    });
    assertEqual(after.logCount, before.logCount + 1, "failed transfer audit count");
    assertEqual(after.dailySpent, before.dailySpent, "failed transfer daily spend rollback");
    assertEqual(after.lastPaid, before.lastPaid, "failed transfer schedule rollback");
    assertEqual(after.targetBalance, null, "failed transfer target account remains absent");
    evidence.result = result;
    evidence.before = before;
    evidence.after = after;
    break;
  }
  case "recovered-failed-transfer": {
    const recoveredPath = path.join(evidenceDirectory, "recovered-failed-transfer.json");
    const recovered = parseRecoveredFailedTransferEvidence(
      JSON.parse(await readFile(recoveredPath, "utf8")) as unknown,
    );
    if (!allowedRpcUrls.has(recovered.rpc_url.replace(/\/$/u, ""))) {
      throw new Error(`Recovered evidence used an unrecognised RPC endpoint: ${recovered.rpc_url}`);
    }
    const transaction = await rpc.jsonRpc<FinalTransactionOutcome>("tx", {
      tx_hash: recovered.transaction_hash,
      sender_account_id: recovered.sender,
      wait_until: "FINAL",
    });
    const verified = verifyRecoveredFailedTransfer(recovered, transaction, {
      agentAccountId,
      amountYocto: "1000000000000000000000",
      contractId,
      failureAccountId,
      failureHash,
      reason: "Native NEAR transfer failed",
    });
    const current = await waitForFinalState({
      describe: "Recovered failed-transfer rollback state",
      load: () => scenarioState(failureHash, failureAccountId),
      isExpected: (state) =>
        state.logCount === recovered.current.log_count &&
        state.dailySpent === recovered.current.daily_spent &&
        state.lastPaid === null &&
        state.pendingRecoveryAt === null &&
        state.targetBalance === null,
    });
    const audit = await near.getAuditLog(100);
    const auditDecision = audit.find((entry) => entry.payment_id === verified.decision.payment_id);
    if (
      !auditDecision ||
      auditDecision.block_height !== verified.decision.block_height ||
      typeof auditDecision.outcome !== "object" ||
      auditDecision.outcome.Rejected !== "Native NEAR transfer failed"
    ) {
      throw new Error("Recovered failed-transfer decision is not present in the live audit log");
    }
    evidence.source = "recovered_final_transaction";
    evidence.recovered_evidence_path = recoveredPath;
    evidence.transaction_hash = verified.transactionHash;
    evidence.result = verified.result;
    evidence.decision = verified.decision;
    evidence.current = current;
    break;
  }
  case "recovered-unauthorized": {
    const recoveredPath = path.join(evidenceDirectory, "recovered-initial-transactions.json");
    const recovered = JSON.parse(await readFile(recoveredPath, "utf8")) as unknown;
    const identity = recoveredUnauthorizedTransactionIdentity(recovered);
    const transaction = await rpc.jsonRpc<FinalTransactionOutcome>("tx", {
      tx_hash: identity.transactionHash,
      sender_account_id: identity.sender,
      wait_until: "FINAL",
    });
    const verified = verifyRecoveredUnauthorizedTransaction(recovered, transaction, {
      amountYocto: "1000000000000000000000",
      contractId,
      reason: "Unauthorized caller",
      recipientHash: workerOneHash,
      workerAccountId: workerOneId,
    });
    evidence.source = "recovered_final_transaction";
    evidence.recovered_evidence_path = recoveredPath;
    evidence.transaction_hash = verified.transactionHash;
    evidence.result = verified.result;
    evidence.current = await snapshot();
    break;
  }
  case "payroll-before": {
    evidence.snapshot = await payrollSnapshot();
    break;
  }
  case "payroll-after": {
    const beforePath = path.join(evidenceDirectory, "acceptance-payroll-before.json");
    const beforeEvidence = JSON.parse(await readFile(beforePath, "utf8")) as {
      snapshot?: Awaited<ReturnType<typeof payrollSnapshot>>;
    };
    if (!beforeEvidence.snapshot) throw new Error("Payroll before-snapshot evidence is missing");
    const before = beforeEvidence.snapshot;
    const amount = 10_000_000_000_000_000_000_000n;
    const after = await waitForFinalState({
      describe: "Successful payroll settlement state",
      load: payrollSnapshot,
      isExpected: (state) =>
        BigInt(state.workerOneBalance) === BigInt(before.workerOneBalance) + amount &&
        BigInt(state.workerTwoBalance) === BigInt(before.workerTwoBalance) + amount &&
        state.logCount === before.logCount + 2 &&
        BigInt(state.dailySpent) === BigInt(before.dailySpent) + amount * 2n &&
        state.workerOneLastPaid > before.workerOneLastPaid &&
        state.workerTwoLastPaid > before.workerTwoLastPaid &&
        state.approvals.length === 2 &&
        state.approvals.every((entry) => entry.outcome === "Approved"),
    });
    assertBigIntIncrease(after.workerOneBalance, before.workerOneBalance, amount, "Worker 1 payment");
    assertBigIntIncrease(after.workerTwoBalance, before.workerTwoBalance, amount, "Worker 2 payment");
    assertEqual(after.logCount, before.logCount + 2, "successful payroll audit count");
    assertEqual(
      BigInt(after.dailySpent),
      BigInt(before.dailySpent) + amount * 2n,
      "successful payroll daily spend",
    );
    if (after.workerOneLastPaid <= before.workerOneLastPaid) {
      throw new Error("Worker 1 schedule did not advance after settlement");
    }
    if (after.workerTwoLastPaid <= before.workerTwoLastPaid) {
      throw new Error("Worker 2 schedule did not advance after settlement");
    }
    if (after.approvals.length !== 2 || after.approvals.some((entry) => entry.outcome !== "Approved")) {
      throw new Error("The two successful settlements did not produce two Approved audit entries");
    }
    evidence.before = before;
    evidence.after = after;
    break;
  }
  case "invalid-recipient": {
    const before = await scenarioState(unknownHash, workerOneId);
    const result = await near.requestPayment({
      recipientHash: unknownHash,
      recipientAccountId: workerOneId,
      amountYocto: "1000000000000000000000",
      chain: "near",
      token: "NEAR",
    });
    assertRejected(result, "Recipient not approved");
    const after = await waitForFinalState({
      describe: "Invalid-recipient rejection state",
      load: () => scenarioState(unknownHash, workerOneId),
      isExpected: (state) =>
        state.logCount === before.logCount + 1 &&
        state.dailySpent === before.dailySpent &&
        state.targetBalance === before.targetBalance,
    });
    assertEqual(after.logCount, before.logCount + 1, "invalid recipient audit count");
    assertEqual(after.dailySpent, before.dailySpent, "invalid recipient daily spend");
    assertEqual(after.targetBalance, before.targetBalance, "invalid recipient balance");
    evidence.result = result;
    evidence.before = before;
    evidence.after = after;
    break;
  }
  case "duplicate-worker1": {
    const before = await scenarioState(workerOneHash, workerOneId);
    if (before.lastPaid === null || before.lastPaid === 0) {
      throw new Error("Worker 1 has no successful payment to duplicate-test");
    }
    const result = await near.requestPayment({
      recipientHash: workerOneHash,
      recipientAccountId: workerOneId,
      amountYocto: "10000000000000000000000",
      chain: "near",
      token: "NEAR",
    });
    assertRejected(result, "Payment not due yet");
    const after = await waitForFinalState({
      describe: "Duplicate-payment rejection state",
      load: () => scenarioState(workerOneHash, workerOneId),
      isExpected: (state) =>
        state.logCount === before.logCount + 1 &&
        state.dailySpent === before.dailySpent &&
        state.lastPaid === before.lastPaid &&
        state.targetBalance === before.targetBalance,
    });
    assertEqual(after.logCount, before.logCount + 1, "duplicate audit count");
    assertEqual(after.dailySpent, before.dailySpent, "duplicate daily spend");
    assertEqual(after.lastPaid, before.lastPaid, "duplicate schedule state");
    assertEqual(after.targetBalance, before.targetBalance, "duplicate worker balance");
    evidence.result = result;
    evidence.before = before;
    evidence.after = after;
    break;
  }
  case "insufficient-worker2": {
    const before = await scenarioState(workerTwoHash, workerTwoId);
    const result = await near.requestPayment({
      recipientHash: workerTwoHash,
      recipientAccountId: workerTwoId,
      amountYocto: "20000000000000000000000000",
      chain: "near",
      token: "NEAR",
    });
    assertRejected(result, "Insufficient contract treasury balance");
    const after = await waitForFinalState({
      describe: "Insufficient-funds rejection state",
      load: () => scenarioState(workerTwoHash, workerTwoId),
      isExpected: (state) =>
        state.logCount === before.logCount + 1 &&
        state.dailySpent === before.dailySpent &&
        state.lastPaid === before.lastPaid &&
        state.targetBalance === before.targetBalance,
    });
    assertEqual(after.logCount, before.logCount + 1, "insufficient-funds audit count");
    assertEqual(after.dailySpent, before.dailySpent, "insufficient-funds daily spend");
    assertEqual(after.lastPaid, before.lastPaid, "insufficient-funds schedule state");
    assertEqual(after.targetBalance, before.targetBalance, "insufficient-funds worker balance");
    evidence.result = result;
    evidence.before = before;
    evidence.after = after;
    break;
  }
  case "agent-permission": {
    const before = await snapshot();
    let rejected = false;
    let rejection = "";
    try {
      const keyStore = new keyStores.InMemoryKeyStore();
      const keyPair = KeyPair.fromString(
        credential.privateKey as `ed25519:${string}` | `secp256k1:${string}`,
      );
      await keyStore.setKey("testnet", credential.accountId, keyPair);
      const connection = new Near({
        networkId: "testnet",
        nodeUrl: rpcUrl,
        walletUrl: "",
        helperUrl: "",
        keyStore,
      });
      const account = await connection.account(credential.accountId);
      await account.functionCall({
        contractId,
        methodName: "add_recipient",
        args: {
          recipient_hash: unknownHash,
          config: {
            name: "Forbidden Agent Mutation",
            personal_cap: "1",
            active: true,
            preferred_chain: "near",
            preferred_token: "NEAR",
            payment_split: [],
            schedule: "Milestone",
          },
        },
        gas: 60_000_000_000_000n,
        attachedDeposit: 0n,
      });
    } catch (reason) {
      rejected = true;
      rejection = reason instanceof Error ? reason.message : String(reason);
    }
    if (!rejected) throw new Error("Restricted agent unexpectedly invoked add_recipient");
    const after = await snapshot();
    assertEqual(after.recipientCount, before.recipientCount, "agent permission recipient count");
    assertEqual(after.logCount, before.logCount, "agent permission audit count");
    evidence.rejected = true;
    evidence.rejection = rejection;
    evidence.before = before;
    evidence.after = after;
    break;
  }
  default:
    throw new Error(
      "Usage: v02-testnet-acceptance.ts <snapshot|payroll-before|payroll-after|failed-transfer|recovered-failed-transfer|recovered-unauthorized|invalid-recipient|duplicate-worker1|insufficient-worker2|agent-permission>",
    );
}

await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
const evidencePath = path.join(evidenceDirectory, `acceptance-${phase}.json`);
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
console.log(`Verified Testnet acceptance phase: ${phase}`);
console.log(`Evidence: ${evidencePath}`);

async function snapshot() {
  const [recipientCount, logCount, dailySpent, recoveryAt, recipients] = await Promise.all([
    near.view<number>("get_recipient_count"),
    near.view<number>("get_log_count"),
    near.view<string>("get_daily_spent"),
    near.view<string | null>("get_pending_native_payment_recovery_at"),
    near.getRecipients(),
  ]);
  return { recipientCount, logCount, dailySpent, recoveryAt, recipients };
}

async function payrollSnapshot() {
  const [base, workerOne, workerTwo, contract, audit, workerOneRecipient, workerTwoRecipient] =
    await Promise.all([
      snapshot(),
      viewAccount(workerOneId),
      viewAccount(workerTwoId),
      viewAccount(contractId),
      near.getAuditLog(20),
      near.view<{ last_paid: number } | null>("get_recipient", {
        recipient_hash: workerOneHash,
      }),
      near.view<{ last_paid: number } | null>("get_recipient", {
        recipient_hash: workerTwoHash,
      }),
    ]);
  if (!workerOne || !workerTwo || !contract || !workerOneRecipient || !workerTwoRecipient) {
    throw new Error("Payroll acceptance accounts or recipients are missing");
  }
  return {
    ...base,
    workerOneBalance: workerOne.amount,
    workerTwoBalance: workerTwo.amount,
    contractBalance: contract.amount,
    workerOneLastPaid: workerOneRecipient.last_paid,
    workerTwoLastPaid: workerTwoRecipient.last_paid,
    approvals: audit
      .filter((entry) => entry.payment_id > base.logCount - 2)
      .slice(0, 2)
      .map((entry) => ({ payment_id: entry.payment_id, outcome: entry.outcome })),
  };
}

async function scenarioState(recipientHash: string, targetAccountId: string) {
  const [logCount, dailySpent, recipient, pendingRecoveryAt, contractAccount, targetAccount] =
    await Promise.all([
      near.view<number>("get_log_count"),
      near.view<string>("get_daily_spent"),
      near.view<{ last_paid: number } | null>("get_recipient", {
        recipient_hash: recipientHash,
      }),
      near.view<string | null>("get_pending_native_payment_recovery_at"),
      viewAccount(contractId),
      viewAccount(targetAccountId, true),
    ]);
  if (!contractAccount) throw new Error(`Contract account ${contractId} is missing`);
  return {
    logCount,
    dailySpent,
    lastPaid: recipient?.last_paid ?? null,
    pendingRecoveryAt,
    contractBalance: contractAccount.amount,
    targetBalance: targetAccount?.amount ?? null,
  };
}

async function viewAccount(accountId: string, allowMissing = false) {
  try {
    return await rpc.rpc<{ amount: string }>({
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    });
  } catch (error) {
    if (allowMissing) return null;
    throw error;
  }
}

async function assertAccountMissing(accountId: string) {
  if (await viewAccount(accountId, true)) {
    throw new Error(`Failure probe account unexpectedly exists: ${accountId}`);
  }
}

function assertRejected(
  result: { approved: boolean; settled: boolean; reason?: string | null },
  reason: string,
) {
  if (result.approved || result.settled || result.reason !== reason) {
    throw new Error(`Expected rejection ${JSON.stringify(reason)}, received ${JSON.stringify(result)}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertBigIntIncrease(actual: string, before: string, increase: bigint, label: string) {
  const expected = BigInt(before) + increase;
  if (BigInt(actual) !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}
