import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  assertApprovedPayment,
  assertFailedTransaction,
  assertFunctionTransaction,
  assertRejectedPayment,
  assertSuccessfulTransaction,
  deployContractSha256,
  explorerTransactionUrl,
  findEvent,
  normalizeAccessKeys,
  type FunctionTransactionExpectation,
} from "./lib/factory-v02-acceptance.js";
import {
  parseTransactionHash,
  sha256,
  submitNearTransaction,
  TestnetRpc,
  verifyKeychainIdentity,
  writePrivateJson,
  type FinalTransaction,
} from "./lib/factory-v02-live.js";

const NEAR_BINARY = "/home/ubuntu/.local/lib/clavis-near/near-v0.31.1/near";
const ROOT_ACCOUNT = "clavis.testnet";
const FACTORY_ACCOUNT = "factory.clavis.testnet";
const OWNER_ACCOUNT = "arinze-worker2.testnet";
const AGENT_ACCOUNT = "arinze-worker1.testnet";
const CHILD_NAME = "clavis-v02-e2e-20261110";
const CHILD_ACCOUNT = `${CHILD_NAME}.${ROOT_ACCOUNT}`;
const LOW_DEPOSIT_NAME = "clavis-v02-low-20261110";
const LOW_DEPOSIT_ACCOUNT = `${LOW_DEPOSIT_NAME}.${ROOT_ACCOUNT}`;
const FAILURE_ACCOUNT = "clavis-v02-missing-20261110.testnet";
const FACTORY_PUBLIC_KEY = "ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD";
const OWNER_PUBLIC_KEY = "ed25519:8zbmkNmENQfdYFqEkcb18qozH9n28YZ1bE7FuSAbyMbK";
const AGENT_PUBLIC_KEY = "ed25519:Htw1X9TG7TwXcMPywYjiRkngX6dUYPxktLWf46KkBmxt";
const ROOT_PUBLIC_KEY = "ed25519:Bzk9o3X52NXSWU8GW2HXFiRWj8TdLYzVKSZQxi7vDq8c";
const DAILY_LIMIT = "1000000000000000000000000";
const PER_PAYMENT_LIMIT = "100000000000000000000000";
const SETTLEMENT_AMOUNT = "1000000000000000000000";
const TEN_NEAR = "10000000000000000000000000";
const INSUFFICIENT_AMOUNT = "5000000000000000000000000";
const SIX_NEAR = "6000000000000000000000000";
const ONE_NEAR = "1000000000000000000000000";
const ZERO_DEPOSIT = "0";
const RPC_URL = (process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com").replace(/\/$/u, "");
const NEAR_CONNECTION = process.env.CLAVIS_NEAR_NETWORK_CONNECTION ?? "testnet-drpc";
const BASELINE_DIRECTORY =
  process.env.CLAVIS_BASELINE_DIRECTORY ??
  "/home/ubuntu/.local/state/clavis-v02-20261110-factory-final";
const BASELINE_PATH = path.join(BASELINE_DIRECTORY, "baseline.json");
const EVIDENCE_DIRECTORY = path.join(BASELINE_DIRECTORY, "execution");
const STATE_PATH = path.join(EVIDENCE_DIRECTORY, "factory-v02-acceptance.json");
const ROOT_WASM_PATH = path.resolve("contract/res/clavis_contract.wasm");
const FACTORY_WASM_PATH = path.resolve("contract/res/clavis_factory.wasm");
const ALLOWED_RPC_URLS = new Set([
  "https://test.rpc.fastnear.com",
  "https://near-testnet.drpc.org",
  "https://testnet-rpc.intea.rs",
  "https://archival-rpc.testnet.near.org",
]);
const RPC_FALLBACKS = [...ALLOWED_RPC_URLS].filter((url) => url !== RPC_URL);

interface TransactionSpec extends FunctionTransactionExpectation {
  cliDeposit: string;
  gas: string;
  publicKey: string;
}

interface StoredTransaction {
  before?: unknown;
  exit_code?: number;
  hash?: string;
  prepared_at: string;
  spec: TransactionSpec;
  submitted_at?: string;
  verified_at?: string;
}

interface AcceptanceState {
  child_account: string;
  child_name: string;
  factory_account: string;
  factory_upgrade?: {
    hash: string;
    verified_at: string;
  };
  final?: unknown;
  network: "testnet";
  preflight?: PreflightEvidence;
  schema: 1;
  transactions: Record<string, StoredTransaction>;
}

interface PreflightEvidence {
  captured_at: string;
  existing_children: Record<string, unknown>;
  factory: FactorySnapshot;
  root: unknown;
  root_wasm_sha256: string;
  factory_wasm_sha256: string;
}

interface FactoryRecord {
  contract_id: string;
  created_at: number | string;
  name: string;
  owner: string;
}

interface FactorySnapshot {
  access_keys: Array<{ permission: unknown; public_key: string }>;
  code_hash: string;
  code_sha256: string;
  contracts: FactoryRecord[];
  root_account: string;
  version: unknown;
}

interface ScenarioSnapshot {
  child_balance: string;
  daily_spent: string;
  last_paid: number | null;
  log_count: number;
  pending_recovery_at: string | null;
  target_balance: string | null;
}

const phase = process.argv[2] ?? "preflight";
if (phase !== "preflight" && phase !== "acceptance" && phase !== "verify") {
  throw new Error("Usage: factory-v02-testnet-acceptance.ts <preflight|acceptance|verify>");
}
const isReadOnlyVerification = phase === "verify";
if (!isReadOnlyVerification && process.env.CLAVIS_NEAR_KEYRING_ACTIVE !== "1") {
  throw new Error("Run this acceptance script through scripts/run-with-clavis-near-keyring.sh");
}
if (!ALLOWED_RPC_URLS.has(RPC_URL)) throw new Error(`Refusing unrecognised Testnet RPC ${RPC_URL}`);
if (NEAR_CONNECTION !== "testnet" && NEAR_CONNECTION !== "testnet-drpc") {
  throw new Error(`Refusing unrecognised NEAR Testnet connection ${NEAR_CONNECTION}`);
}
for (const accountId of [
  ROOT_ACCOUNT,
  FACTORY_ACCOUNT,
  OWNER_ACCOUNT,
  AGENT_ACCOUNT,
  CHILD_ACCOUNT,
  FAILURE_ACCOUNT,
]) {
  if (!accountId.endsWith(".testnet")) throw new Error(`Refusing non-Testnet account ${accountId}`);
}

const rpc = new TestnetRpc(RPC_URL, RPC_FALLBACKS);
await rpc.assertTestnet();
if (phase === "preflight") verifyAllKeychainIdentities();

const baseline = JSON.parse(await readFile(BASELINE_PATH, "utf8")) as Record<string, unknown>;
const rootWasm = await readFile(ROOT_WASM_PATH);
const factoryWasm = await readFile(FACTORY_WASM_PATH);
const rootWasmSha256 = sha256(rootWasm);
const factoryWasmSha256 = sha256(factoryWasm);
const expectedRootCodeHash = base58Sha256(rootWasm);
const expectedFactoryCodeHash = base58Sha256(factoryWasm);
const state = await loadState();

if (phase === "preflight") {
  await runPreflight();
} else {
  await runAcceptance();
}

async function runPreflight(): Promise<void> {
  const baselineFactoryHash = baselineAccountCodeHash(FACTORY_ACCOUNT);
  const baselineRootHash = baselineAccountCodeHash(ROOT_ACCOUNT);
  assert.equal(baselineRootHash, expectedRootCodeHash, "baseline root artifact hash");
  const currentRoot = await captureRoot();
  assert.equal((currentRoot as { code_hash: string }).code_hash, expectedRootCodeHash);
  assert.equal((currentRoot as { version: string }).version, "0.2.0");
  assert.equal((currentRoot as { pending_recovery_at: unknown }).pending_recovery_at, null);

  if (!state.preflight) {
    const factory = await captureFactory();
    assert.equal(factory.code_hash, baselineFactoryHash, "factory pre-upgrade code hash");
    assert.notEqual(factory.code_hash, expectedFactoryCodeHash, "factory must still be legacy");
    assert.equal(factory.root_account, ROOT_ACCOUNT);
    assert.deepEqual(factory.contracts, baselineFactoryContracts());
    assert.deepEqual(factory.access_keys, expectedFactoryAccessKeys());
    await assertAccountMissing(CHILD_ACCOUNT);
    await assertAccountMissing(LOW_DEPOSIT_ACCOUNT);
    await assertAccountMissing(FAILURE_ACCOUNT);
    assert.equal(await rpc.view<boolean>(FACTORY_ACCOUNT, "is_name_available", { name: CHILD_NAME }), true);
    assert.equal(
      await rpc.view<FactoryRecord | null>(FACTORY_ACCOUNT, "get_contract_by_owner", {
        owner: OWNER_ACCOUNT,
      }),
      null,
    );
    const existingChildren = Object.fromEntries(
      await Promise.all(
        factory.contracts.map(async (record) => [
          record.contract_id,
          await capturePayrollContract(record.contract_id),
        ]),
      ),
    );
    state.preflight = {
      captured_at: new Date().toISOString(),
      existing_children: existingChildren,
      factory,
      root: currentRoot,
      root_wasm_sha256: rootWasmSha256,
      factory_wasm_sha256: factoryWasmSha256,
    };
    await saveState();
  } else {
    assert.equal(state.preflight.root_wasm_sha256, rootWasmSha256, "root artifact changed");
    assert.equal(state.preflight.factory_wasm_sha256, factoryWasmSha256, "factory artifact changed");
    const factory = await captureFactory();
    if (factory.code_hash === baselineFactoryHash) {
      assert.deepEqual(factory, state.preflight.factory, "legacy factory changed after preflight");
    } else if (factory.code_hash !== expectedFactoryCodeHash) {
      throw new Error(`Factory code hash changed unexpectedly to ${factory.code_hash}`);
    }
  }

  console.log(`Verified factory upgrade preflight on NEAR Testnet.`);
  console.log(`Child reserved for acceptance: ${CHILD_ACCOUNT}`);
  console.log(`Evidence: ${STATE_PATH}`);
}

async function runAcceptance(): Promise<void> {
  if (!state.preflight) throw new Error("Run the preflight phase before factory acceptance");
  assert.equal(state.preflight.root_wasm_sha256, rootWasmSha256, "root artifact changed after preflight");
  assert.equal(
    state.preflight.factory_wasm_sha256,
    factoryWasmSha256,
    "factory artifact changed after preflight",
  );
  if (!isReadOnlyVerification && new Date().getUTCHours() < 6) {
    throw new Error("Payment acceptance runs only during the 06:00–24:00 UTC policy window");
  }
  await verifyFactoryUpgrade();
  await verifyFactoryNegativePaths();
  await createAndVerifyChild();
  await addPrimaryRecipient();
  await verifyOwnerOnlyAccessControl();
  await verifySuccessfulSettlement();
  await verifyDuplicateRejection();
  await verifyFailedTransferRollback();
  await verifyInsufficientFunds();
  const final = await captureFinalState();
  if (isReadOnlyVerification) {
    console.log(`Replayed factory v0.2 evidence without submitting transactions: ${CHILD_ACCOUNT}`);
  } else {
    state.final = final;
    await saveState();
    console.log(`Verified factory v0.2 and child acceptance: ${CHILD_ACCOUNT}`);
  }
  console.log(`Evidence: ${STATE_PATH}`);
}

async function verifyFactoryUpgrade(): Promise<void> {
  const factory = await captureFactory();
  assert.equal(factory.code_hash, expectedFactoryCodeHash, "factory deployed code hash");
  assert.equal(factory.code_sha256, factoryWasmSha256, "factory deployed code bytes");
  assert.equal(factory.version, "0.2.0", "factory version");
  assert.equal(factory.root_account, ROOT_ACCOUNT, "factory root account");
  assertFactoryRegistryForCurrentPhase(factory.contracts);
  assert.deepEqual(factory.access_keys, expectedFactoryAccessKeys(), "factory access control");

  const logPath = path.join(EVIDENCE_DIRECTORY, "factory-deploy.log");
  const hash = parseTransactionHash(await readFile(logPath, "utf8"));
  const transaction = await rpc.transaction(hash, FACTORY_ACCOUNT);
  assert.equal(transaction.final_execution_status, "FINAL");
  assert.equal(transaction.transaction?.hash, hash);
  assert.equal(transaction.transaction?.signer_id, FACTORY_ACCOUNT);
  assert.equal(transaction.transaction?.receiver_id, FACTORY_ACCOUNT);
  assertSuccessfulTransaction(transaction);
  const actions = transaction.transaction?.actions ?? [];
  assert.equal(actions.length, 1, "factory deployment action count");
  const code = actions[0]?.DeployContract?.code;
  if (!code) throw new Error("Factory upgrade transaction did not contain DeployContract code");
  assert.equal(deployContractSha256(code), factoryWasmSha256, "factory transaction code");
  if (isReadOnlyVerification) {
    assert.equal(state.factory_upgrade?.hash, hash, "recorded factory upgrade transaction");
  } else {
    state.factory_upgrade = { hash, verified_at: new Date().toISOString() };
    await saveState();
  }
  console.log(`Verified factory upgrade transaction: ${hash}`);
}

async function verifyFactoryNegativePaths(): Promise<void> {
  const recordedChild = state.transactions["factory-create-child"]?.hash;
  if (recordedChild) {
    await expectedFailure(
      "factory-invalid-name",
      factoryCreateSpec("Invalid Name!", OWNER_ACCOUNT, OWNER_ACCOUNT, "6 NEAR", SIX_NEAR),
      "Business name may only use lowercase letters, numbers, and hyphens",
    );
    await expectedFailure(
      "factory-low-deposit",
      factoryCreateSpec(LOW_DEPOSIT_NAME, OWNER_ACCOUNT, OWNER_ACCOUNT, "1 NEAR", ONE_NEAR),
      "Attach at least 6 NEAR for contract storage and operating balance",
    );
    await expectedFailure(
      "factory-unauthorized-owner",
      factoryCreateSpec(CHILD_NAME, OWNER_ACCOUNT, AGENT_ACCOUNT, "1 NEAR", ONE_NEAR),
      "The owner must submit the deployment",
    );
    return;
  }
  await assertChildAbsentAndUnregistered();
  await expectedFailure(
    "factory-invalid-name",
    factoryCreateSpec("Invalid Name!", OWNER_ACCOUNT, OWNER_ACCOUNT, "6 NEAR", SIX_NEAR),
    "Business name may only use lowercase letters, numbers, and hyphens",
  );
  await assertChildAbsentAndUnregistered();
  await expectedFailure(
    "factory-low-deposit",
    factoryCreateSpec(LOW_DEPOSIT_NAME, OWNER_ACCOUNT, OWNER_ACCOUNT, "1 NEAR", ONE_NEAR),
    "Attach at least 6 NEAR for contract storage and operating balance",
  );
  await assertAccountMissing(LOW_DEPOSIT_ACCOUNT);
  await assertChildAbsentAndUnregistered();
  await expectedFailure(
    "factory-unauthorized-owner",
    factoryCreateSpec(CHILD_NAME, OWNER_ACCOUNT, AGENT_ACCOUNT, "1 NEAR", ONE_NEAR),
    "The owner must submit the deployment",
  );
  await assertChildAbsentAndUnregistered();
}

async function createAndVerifyChild(): Promise<void> {
  const spec = factoryCreateSpec(CHILD_NAME, OWNER_ACCOUNT, OWNER_ACCOUNT, "6 NEAR", SIX_NEAR);
  const transaction = await successfulCall("factory-create-child", spec, async () => {
    await assertChildAbsentAndUnregistered();
  });
  assert.equal(assertSuccessfulTransaction(transaction), CHILD_ACCOUNT, "factory return value");
  const event = findEvent(transaction, "clavis_factory", "payroll_created");
  const record = event.data?.[0] as FactoryRecord | undefined;
  if (!record) throw new Error("Factory payroll_created event has no record");
  assert.equal(record.name, CHILD_NAME);
  assert.equal(record.contract_id, CHILD_ACCOUNT);
  assert.equal(record.owner, OWNER_ACCOUNT);

  const child = await capturePayrollContract(CHILD_ACCOUNT);
  assert.equal((child as { code_hash: string }).code_hash, expectedRootCodeHash);
  assert.equal((child as { code_sha256: string }).code_sha256, rootWasmSha256);
  assert.equal((child as { version: string }).version, "0.2.0");
  assert.equal((child as { owner: string }).owner, OWNER_ACCOUNT);
  assert.equal((child as { agent: string }).agent, AGENT_ACCOUNT);
  assert.deepEqual((child as { access_keys: unknown[] }).access_keys, []);
  assert.equal((child as { daily_limit: string }).daily_limit, DAILY_LIMIT);
  assert.equal((child as { per_payment_limit: string }).per_payment_limit, PER_PAYMENT_LIMIT);

  const contracts = await rpc.view<FactoryRecord[]>(FACTORY_ACCOUNT, "get_all_contracts");
  assert.deepEqual(contracts.slice(0, -1), state.preflight?.factory.contracts);
  assert.deepEqual(contracts.at(-1), record);
}

async function addPrimaryRecipient(): Promise<void> {
  const args = {
    config: {
      active: true,
      name: "Factory Acceptance Worker 2",
      payment_split: [],
      personal_cap: PER_PAYMENT_LIMIT,
      preferred_chain: "near",
      preferred_token: "NEAR",
      schedule: "Weekly",
    },
    recipient_hash: accountHash(OWNER_ACCOUNT),
  };
  const spec = callSpec(CHILD_ACCOUNT, "add_recipient", args, OWNER_ACCOUNT, OWNER_PUBLIC_KEY);
  const transaction = await successfulCall("child-add-worker2", spec, async () => {
    assert.equal(await childRecipient(accountHash(OWNER_ACCOUNT)), null);
  });
  assert.equal(assertSuccessfulTransaction(transaction), null);
  const recipient = await childRecipient(accountHash(OWNER_ACCOUNT));
  assert.equal(recipient?.name, args.config.name);
  assert.equal(recipient?.personal_cap, PER_PAYMENT_LIMIT);
  assert.equal(recipient?.schedule, "Weekly");
}

async function verifyOwnerOnlyAccessControl(): Promise<void> {
  const before = await captureChildPolicy();
  const spec = callSpec(
    CHILD_ACCOUNT,
    "update_limits",
    { daily: DAILY_LIMIT, per_payment: PER_PAYMENT_LIMIT },
    AGENT_ACCOUNT,
    AGENT_PUBLIC_KEY,
  );
  await expectedFailure("child-agent-owner-mutation", spec, "Owner authorization required", before);
  assert.deepEqual(await captureChildPolicy(), before);
}

async function verifySuccessfulSettlement(): Promise<void> {
  const storedBefore = state.transactions["child-payment-success"]?.before as
    | ScenarioSnapshot
    | undefined;
  const before = storedBefore ?? (await scenarioSnapshot(accountHash(OWNER_ACCOUNT), OWNER_ACCOUNT));
  const spec = paymentSpec(accountHash(OWNER_ACCOUNT), OWNER_ACCOUNT, SETTLEMENT_AMOUNT);
  const transaction = await successfulCall("child-payment-success", spec, undefined, before);
  const result = assertApprovedPayment(assertSuccessfulTransaction(transaction));
  assertPaymentEvent(transaction, result.payment_id, "Approved");
  const after = await scenarioSnapshot(accountHash(OWNER_ACCOUNT), OWNER_ACCOUNT);
  if (state.transactions["child-payment-duplicate"]?.hash) {
    await assertCurrentAuditDecision(result.payment_id, "Approved");
    assert.equal(after.pending_recovery_at, null);
    assert.ok(BigInt(after.daily_spent) >= BigInt(before.daily_spent) + BigInt(SETTLEMENT_AMOUNT));
    assert.ok((after.last_paid ?? 0) > (before.last_paid ?? 0));
    return;
  }
  assert.equal(BigInt(after.target_balance ?? "0"), BigInt(before.target_balance ?? "0") + BigInt(SETTLEMENT_AMOUNT));
  assert.equal(BigInt(after.child_balance), BigInt(before.child_balance) - BigInt(SETTLEMENT_AMOUNT));
  assert.equal(BigInt(after.daily_spent), BigInt(before.daily_spent) + BigInt(SETTLEMENT_AMOUNT));
  assert.equal(after.log_count, before.log_count + 1);
  assert.ok((after.last_paid ?? 0) > (before.last_paid ?? 0));
  assert.equal(after.pending_recovery_at, null);
}

async function verifyDuplicateRejection(): Promise<void> {
  const storedBefore = state.transactions["child-payment-duplicate"]?.before as
    | ScenarioSnapshot
    | undefined;
  const before = storedBefore ?? (await scenarioSnapshot(accountHash(OWNER_ACCOUNT), OWNER_ACCOUNT));
  const transaction = await successfulCall(
    "child-payment-duplicate",
    paymentSpec(accountHash(OWNER_ACCOUNT), OWNER_ACCOUNT, SETTLEMENT_AMOUNT),
    undefined,
    before,
  );
  const result = assertRejectedPayment(assertSuccessfulTransaction(transaction), "Payment is not due");
  assertPaymentEvent(transaction, result.payment_id, { Rejected: "Payment is not due" });
  const after = await scenarioSnapshot(accountHash(OWNER_ACCOUNT), OWNER_ACCOUNT);
  if (state.transactions["child-add-failure-probe"]?.hash) {
    await assertCurrentAuditDecision(result.payment_id, { Rejected: "Payment is not due" });
    assert.equal(after.daily_spent, before.daily_spent);
    assert.equal(after.last_paid, before.last_paid);
    assert.equal(after.pending_recovery_at, null);
    assert.ok(after.log_count >= before.log_count + 1);
    return;
  }
  assert.equal(after.target_balance, before.target_balance);
  assert.equal(after.child_balance, before.child_balance);
  assert.equal(after.daily_spent, before.daily_spent);
  assert.equal(after.last_paid, before.last_paid);
  assert.equal(after.log_count, before.log_count + 1);
}

async function verifyFailedTransferRollback(): Promise<void> {
  const failureHash = accountHash(FAILURE_ACCOUNT);
  await successfulCall(
    "child-add-failure-probe",
    callSpec(
      CHILD_ACCOUNT,
      "add_recipient",
      {
        config: {
          active: true,
          name: "Factory Acceptance Failure Probe",
          payment_split: [],
          personal_cap: PER_PAYMENT_LIMIT,
          preferred_chain: "near",
          preferred_token: "NEAR",
          schedule: "Milestone",
        },
        recipient_hash: failureHash,
      },
      OWNER_ACCOUNT,
      OWNER_PUBLIC_KEY,
    ),
    async () => {
      await assertAccountMissing(FAILURE_ACCOUNT);
      assert.equal(await childRecipient(failureHash), null);
    },
  );
  const storedBefore = state.transactions["child-payment-failed-transfer"]?.before as
    | ScenarioSnapshot
    | undefined;
  const before = storedBefore ?? (await scenarioSnapshot(failureHash, FAILURE_ACCOUNT));
  const transaction = await successfulCall(
    "child-payment-failed-transfer",
    paymentSpec(failureHash, FAILURE_ACCOUNT, SETTLEMENT_AMOUNT),
    undefined,
    before,
  );
  const result = assertRejectedPayment(
    assertSuccessfulTransaction(transaction),
    "Native NEAR transfer failed",
  );
  assertPaymentEvent(transaction, result.payment_id, { Rejected: "Native NEAR transfer failed" });
  const after = await scenarioSnapshot(failureHash, FAILURE_ACCOUNT);
  if (state.transactions["child-remove-failure-probe"]?.hash) {
    await assertCurrentAuditDecision(result.payment_id, {
      Rejected: "Native NEAR transfer failed",
    });
    assert.equal(after.target_balance, null);
    assert.equal(after.daily_spent, before.daily_spent);
    assert.equal(after.pending_recovery_at, null);
    assert.ok(after.log_count >= before.log_count + 1);
  } else {
    assert.equal(after.target_balance, null);
    assert.equal(after.child_balance, before.child_balance);
    assert.equal(after.daily_spent, before.daily_spent);
    assert.equal(after.last_paid, before.last_paid);
    assert.equal(after.pending_recovery_at, null);
    assert.equal(after.log_count, before.log_count + 1);
  }

  await successfulCall(
    "child-remove-failure-probe",
    callSpec(
      CHILD_ACCOUNT,
      "remove_recipient",
      { recipient_hash: failureHash },
      OWNER_ACCOUNT,
      OWNER_PUBLIC_KEY,
    ),
  );
  assert.equal(await childRecipient(failureHash), null);
}

async function verifyInsufficientFunds(): Promise<void> {
  const recipientHash = accountHash(OWNER_ACCOUNT);
  await successfulCall(
    "child-insufficient-limits",
    callSpec(
      CHILD_ACCOUNT,
      "update_limits",
      { daily: TEN_NEAR, per_payment: TEN_NEAR },
      OWNER_ACCOUNT,
      OWNER_PUBLIC_KEY,
    ),
  );
  await successfulCall(
    "child-insufficient-cap",
    callSpec(
      CHILD_ACCOUNT,
      "update_recipient_cap",
      { personal_cap: TEN_NEAR, recipient_hash: recipientHash },
      OWNER_ACCOUNT,
      OWNER_PUBLIC_KEY,
    ),
  );
  await successfulCall(
    "child-insufficient-schedule",
    callSpec(
      CHILD_ACCOUNT,
      "update_schedule",
      { recipient_hash: recipientHash, schedule: "Milestone" },
      OWNER_ACCOUNT,
      OWNER_PUBLIC_KEY,
    ),
  );
  const storedBefore = state.transactions["child-payment-insufficient"]?.before as
    | ScenarioSnapshot
    | undefined;
  const before = storedBefore ?? (await scenarioSnapshot(recipientHash, OWNER_ACCOUNT));
  const transaction = await successfulCall(
    "child-payment-insufficient",
    paymentSpec(recipientHash, OWNER_ACCOUNT, INSUFFICIENT_AMOUNT),
    undefined,
    before,
  );
  const result = assertRejectedPayment(
    assertSuccessfulTransaction(transaction),
    "Insufficient contract treasury balance",
  );
  assertPaymentEvent(transaction, result.payment_id, {
    Rejected: "Insufficient contract treasury balance",
  });
  const after = await scenarioSnapshot(recipientHash, OWNER_ACCOUNT);
  if (state.transactions["child-restore-cap"]?.hash) {
    await assertCurrentAuditDecision(result.payment_id, {
      Rejected: "Insufficient contract treasury balance",
    });
    assert.equal(after.daily_spent, before.daily_spent);
    assert.equal(after.last_paid, before.last_paid);
    assert.equal(after.pending_recovery_at, null);
    assert.ok(after.log_count >= before.log_count + 1);
  } else {
    assert.equal(after.target_balance, before.target_balance);
    assert.equal(after.child_balance, before.child_balance);
    assert.equal(after.daily_spent, before.daily_spent);
    assert.equal(after.last_paid, before.last_paid);
    assert.equal(after.log_count, before.log_count + 1);
  }

  await successfulCall(
    "child-restore-cap",
    callSpec(
      CHILD_ACCOUNT,
      "update_recipient_cap",
      { personal_cap: PER_PAYMENT_LIMIT, recipient_hash: recipientHash },
      OWNER_ACCOUNT,
      OWNER_PUBLIC_KEY,
    ),
  );
  await successfulCall(
    "child-restore-schedule",
    callSpec(
      CHILD_ACCOUNT,
      "update_schedule",
      { recipient_hash: recipientHash, schedule: "Weekly" },
      OWNER_ACCOUNT,
      OWNER_PUBLIC_KEY,
    ),
  );
  await successfulCall(
    "child-restore-limits",
    callSpec(
      CHILD_ACCOUNT,
      "update_limits",
      { daily: DAILY_LIMIT, per_payment: PER_PAYMENT_LIMIT },
      OWNER_ACCOUNT,
      OWNER_PUBLIC_KEY,
    ),
  );
}

async function captureFinalState(): Promise<unknown> {
  const factory = await captureFactory();
  const root = await captureRoot();
  const child = await capturePayrollContract(CHILD_ACCOUNT);
  const existingChildren = Object.fromEntries(
    await Promise.all(
      Object.keys(state.preflight?.existing_children ?? {}).map(async (accountId) => [
        accountId,
        await capturePayrollContract(accountId),
      ]),
    ),
  );
  assert.deepEqual(existingChildren, state.preflight?.existing_children, "existing child state");
  assert.deepEqual(root, state.preflight?.root, "root state after factory workflow");
  assert.equal(factory.version, "0.2.0");
  assert.equal(factory.code_hash, expectedFactoryCodeHash);
  assert.deepEqual(factory.access_keys, expectedFactoryAccessKeys());
  const contracts = factory.contracts;
  assert.equal(contracts.length, (state.preflight?.factory.contracts.length ?? 0) + 1);
  assert.equal(contracts.at(-1)?.contract_id, CHILD_ACCOUNT);
  assert.deepEqual((child as { access_keys: unknown[] }).access_keys, []);
  assert.equal((child as { owner: string }).owner, OWNER_ACCOUNT);
  assert.equal((child as { agent: string }).agent, AGENT_ACCOUNT);
  assert.equal((child as { daily_limit: string }).daily_limit, DAILY_LIMIT);
  assert.equal((child as { per_payment_limit: string }).per_payment_limit, PER_PAYMENT_LIMIT);
  assert.equal((child as { recipient_count: number }).recipient_count, 1);
  assert.equal((child as { pending_recovery_at: unknown }).pending_recovery_at, null);
  return {
    captured_at: new Date().toISOString(),
    child,
    existing_children: existingChildren,
    explorer_links: Object.fromEntries(
      Object.entries(state.transactions)
        .filter(([, transaction]) => transaction.hash)
        .map(([label, transaction]) => [label, explorerTransactionUrl(transaction.hash as string)]),
    ),
    factory,
    factory_upgrade_explorer: state.factory_upgrade
      ? explorerTransactionUrl(state.factory_upgrade.hash)
      : null,
    root,
  };
}

async function expectedFailure(
  label: string,
  spec: TransactionSpec,
  expectedMessage: string,
  before?: unknown,
): Promise<void> {
  const transaction = await ensureTransaction(label, spec, before);
  assertFunctionTransaction(transaction, spec);
  assertFailedTransaction(transaction, expectedMessage);
  if (!isReadOnlyVerification) {
    markVerified(label);
    await saveState();
  }
  console.log(`Verified rejected transaction ${label}: ${state.transactions[label]?.hash}`);
}

async function successfulCall(
  label: string,
  spec: TransactionSpec,
  beforeSubmit?: () => Promise<void>,
  before?: unknown,
): Promise<FinalTransaction> {
  if (!state.transactions[label]?.hash && beforeSubmit) await beforeSubmit();
  const transaction = await ensureTransaction(label, spec, before);
  assertFunctionTransaction(transaction, spec);
  assertSuccessfulTransaction(transaction);
  if (!isReadOnlyVerification) {
    markVerified(label);
    await saveState();
  }
  console.log(`Verified successful transaction ${label}: ${state.transactions[label]?.hash}`);
  return transaction;
}

async function ensureTransaction(
  label: string,
  spec: TransactionSpec,
  before?: unknown,
): Promise<FinalTransaction> {
  let stored = state.transactions[label];
  if (isReadOnlyVerification) {
    if (!stored?.hash) {
      throw new Error(`Read-only verification requires a recorded transaction for ${label}`);
    }
    assert.deepEqual(stored.spec, spec, `${label} transaction specification changed`);
    return rpc.transaction(stored.hash, spec.signerId);
  }
  if (stored) {
    if (!stored.hash) {
      const transcriptPath = path.join(EVIDENCE_DIRECTORY, `${label}.log`);
      try {
        stored.hash = parseTransactionHash(await readFile(transcriptPath, "utf8"));
        await saveState();
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        if (!/did not contain a transaction hash|ENOENT/iu.test(message)) throw reason;
        if (!isDeepStrictEqual(stored.spec, spec)) {
          if (/ENOENT/iu.test(message)) {
            throw new Error(`Refusing to replace ${label} without an unsubmitted CLI transcript`);
          }
          stored = { before, prepared_at: new Date().toISOString(), spec };
          state.transactions[label] = stored;
          await saveState();
        }
      }
    }
    assert.deepEqual(stored.spec, spec, `${label} transaction specification changed`);
  } else {
    stored = { before, prepared_at: new Date().toISOString(), spec };
    state.transactions[label] = stored;
    await saveState();
  }
  if (!stored.hash) {
    const submission = await submitNearTransaction(NEAR_BINARY, {
      args: spec.args,
      deposit: spec.cliDeposit,
      evidenceDirectory: EVIDENCE_DIRECTORY,
      gas: spec.gas,
      label,
      methodName: spec.methodName,
      networkName: NEAR_CONNECTION,
      publicKey: spec.publicKey,
      receiverId: spec.receiverId,
      signerId: spec.signerId,
    });
    stored.exit_code = submission.exitCode;
    stored.hash = submission.hash;
    stored.submitted_at = new Date().toISOString();
    await saveState();
  }
  return rpc.transaction(stored.hash, spec.signerId);
}

function markVerified(label: string): void {
  const transaction = state.transactions[label];
  if (!transaction) throw new Error(`Missing transaction state for ${label}`);
  transaction.verified_at = new Date().toISOString();
}

function factoryCreateSpec(
  name: string,
  owner: string,
  signerId: string,
  cliDeposit: string,
  depositYocto: string,
): TransactionSpec {
  return {
    args: {
      agent: AGENT_ACCOUNT,
      daily_limit: DAILY_LIMIT,
      name,
      owner,
      per_payment_limit: PER_PAYMENT_LIMIT,
    },
    cliDeposit,
    depositYocto,
    gas: "300 TeraGas",
    methodName: "create_payroll",
    publicKey: signerId === OWNER_ACCOUNT ? OWNER_PUBLIC_KEY : AGENT_PUBLIC_KEY,
    receiverId: FACTORY_ACCOUNT,
    signerId,
  };
}

function callSpec(
  receiverId: string,
  methodName: string,
  args: Record<string, unknown>,
  signerId: string,
  publicKey: string,
): TransactionSpec {
  return {
    args,
    cliDeposit: "0 NEAR",
    depositYocto: ZERO_DEPOSIT,
    gas: "100 TeraGas",
    methodName,
    publicKey,
    receiverId,
    signerId,
  };
}

function paymentSpec(
  recipientHash: string,
  recipientAccountId: string,
  amount: string,
): TransactionSpec {
  return callSpec(
    CHILD_ACCOUNT,
    "request_payment",
    {
      amount,
      chain: "near",
      recipient_account_id: recipientAccountId,
      recipient_hash: recipientHash,
      token: "NEAR",
    },
    AGENT_ACCOUNT,
    AGENT_PUBLIC_KEY,
  );
}

async function assertChildAbsentAndUnregistered(): Promise<void> {
  await assertAccountMissing(CHILD_ACCOUNT);
  const contracts = await rpc.view<FactoryRecord[]>(FACTORY_ACCOUNT, "get_all_contracts");
  assert.equal(contracts.some((record) => record.contract_id === CHILD_ACCOUNT), false);
  assert.equal(await rpc.view<boolean>(FACTORY_ACCOUNT, "is_name_available", { name: CHILD_NAME }), true);
  assert.equal(
    await rpc.view<FactoryRecord | null>(FACTORY_ACCOUNT, "get_contract_by_owner", {
      owner: OWNER_ACCOUNT,
    }),
    null,
  );
}

async function assertAccountMissing(accountId: string): Promise<void> {
  assert.equal(await rpc.account(accountId, true), null, `${accountId} must be absent`);
}

async function captureFactory(): Promise<FactorySnapshot> {
  const account = await requiredAccount(FACTORY_ACCOUNT);
  return {
    access_keys: normalizeAccessKeys(await rpc.accessKeys(FACTORY_ACCOUNT)),
    code_hash: account.code_hash,
    code_sha256: await rpc.codeSha256(FACTORY_ACCOUNT),
    contracts: await rpc.view<FactoryRecord[]>(FACTORY_ACCOUNT, "get_all_contracts"),
    root_account: await rpc.view<string>(FACTORY_ACCOUNT, "get_root_account"),
    version: await safeView(FACTORY_ACCOUNT, "contract_version"),
  };
}

async function captureRoot(): Promise<unknown> {
  const account = await requiredAccount(ROOT_ACCOUNT);
  return {
    access_keys: normalizeAccessKeys(await rpc.accessKeys(ROOT_ACCOUNT)),
    agent: await rpc.view<string>(ROOT_ACCOUNT, "get_agent"),
    code_hash: account.code_hash,
    code_sha256: await rpc.codeSha256(ROOT_ACCOUNT),
    daily_limit: await rpc.view<string>(ROOT_ACCOUNT, "get_daily_limit"),
    daily_spent: await rpc.view<string>(ROOT_ACCOUNT, "get_daily_spent"),
    log_count: await rpc.view<number>(ROOT_ACCOUNT, "get_log_count"),
    owner: await rpc.view<string>(ROOT_ACCOUNT, "get_owner"),
    paused: await rpc.view<boolean>(ROOT_ACCOUNT, "is_paused"),
    pending_recovery_at: await rpc.view<string | null>(
      ROOT_ACCOUNT,
      "get_pending_native_payment_recovery_at",
    ),
    per_payment_limit: await rpc.view<string>(ROOT_ACCOUNT, "get_per_payment_limit"),
    recipient_count: await rpc.view<number>(ROOT_ACCOUNT, "get_recipient_count"),
    version: await rpc.view<string>(ROOT_ACCOUNT, "contract_version"),
  };
}

async function capturePayrollContract(accountId: string): Promise<unknown> {
  const account = await requiredAccount(accountId);
  return {
    access_keys: normalizeAccessKeys(await rpc.accessKeys(accountId)),
    agent: await safeView(accountId, "get_agent"),
    code_hash: account.code_hash,
    code_sha256: await rpc.codeSha256(accountId),
    daily_limit: await safeView(accountId, "get_daily_limit"),
    daily_spent: await safeView(accountId, "get_daily_spent"),
    log_count: await safeView(accountId, "get_log_count"),
    owner: await safeView(accountId, "get_owner"),
    paused: await safeView(accountId, "is_paused"),
    pending_recovery_at: await safeView(accountId, "get_pending_native_payment_recovery_at"),
    per_payment_limit: await safeView(accountId, "get_per_payment_limit"),
    recipient_count: await safeView(accountId, "get_recipient_count"),
    version: await safeView(accountId, "contract_version"),
  };
}

async function captureChildPolicy(): Promise<unknown> {
  return {
    agent: await rpc.view<string>(CHILD_ACCOUNT, "get_agent"),
    daily_limit: await rpc.view<string>(CHILD_ACCOUNT, "get_daily_limit"),
    owner: await rpc.view<string>(CHILD_ACCOUNT, "get_owner"),
    per_payment_limit: await rpc.view<string>(CHILD_ACCOUNT, "get_per_payment_limit"),
  };
}

async function scenarioSnapshot(
  recipientHash: string,
  targetAccountId: string,
): Promise<ScenarioSnapshot> {
  const child = await requiredAccount(CHILD_ACCOUNT);
  const target = await rpc.account(targetAccountId, true);
  const recipient = await childRecipient(recipientHash);
  return {
    child_balance: child.amount,
    daily_spent: await rpc.view<string>(CHILD_ACCOUNT, "get_daily_spent"),
    last_paid: recipient?.last_paid ?? null,
    log_count: await rpc.view<number>(CHILD_ACCOUNT, "get_log_count"),
    pending_recovery_at: await rpc.view<string | null>(
      CHILD_ACCOUNT,
      "get_pending_native_payment_recovery_at",
    ),
    target_balance: target?.amount ?? null,
  };
}

async function childRecipient(recipientHash: string): Promise<{
  last_paid: number;
  name: string;
  personal_cap: string;
  schedule: string;
} | null> {
  return rpc.view(CHILD_ACCOUNT, "get_recipient", { recipient_hash: recipientHash });
}

async function requiredAccount(accountId: string) {
  const account = await rpc.account(accountId);
  if (!account) throw new Error(`Required account is missing: ${accountId}`);
  return account;
}

async function safeView(accountId: string, methodName: string): Promise<unknown> {
  try {
    return await rpc.view(accountId, methodName);
  } catch (reason) {
    return { unavailable: reason instanceof Error ? reason.message : String(reason) };
  }
}

function assertPaymentEvent(
  transaction: FinalTransaction,
  paymentId: number,
  outcome: "Approved" | { Rejected: string },
): void {
  const event = findEvent(transaction, "clavis", "payment_decision");
  const entry = event.data?.[0] as { outcome?: unknown; payment_id?: number } | undefined;
  if (!entry) throw new Error("Payment decision event has no audit entry");
  assert.equal(entry.payment_id, paymentId);
  assert.deepEqual(entry.outcome, outcome);
}

async function assertCurrentAuditDecision(
  paymentId: number,
  outcome: "Approved" | { Rejected: string },
): Promise<void> {
  const audit = await rpc.view<Array<{ outcome: unknown; payment_id: number }>>(
    CHILD_ACCOUNT,
    "get_audit_log_reverse",
    { from: 0, limit: 100 },
  );
  const entry = audit.find((candidate) => candidate.payment_id === paymentId);
  if (!entry) throw new Error(`Current child audit is missing payment ${paymentId}`);
  assert.deepEqual(entry.outcome, outcome);
}

function expectedFactoryAccessKeys() {
  return [{ permission: "FullAccess", public_key: FACTORY_PUBLIC_KEY }];
}

function assertFactoryRegistryForCurrentPhase(contracts: FactoryRecord[]): void {
  const baselineContracts = state.preflight?.factory.contracts ?? [];
  const currentById = new Map(contracts.map((record) => [record.contract_id, record]));
  for (const expected of baselineContracts) {
    assert.deepEqual(
      currentById.get(expected.contract_id),
      expected,
      `preserved factory record ${expected.contract_id}`,
    );
  }
  if (!state.transactions["factory-create-child"]?.hash) {
    assert.deepEqual(contracts, baselineContracts, "factory registry before child creation");
    return;
  }
  assert.equal(contracts.length, baselineContracts.length + 1, "factory registry after child creation");
  const childRecord = currentById.get(CHILD_ACCOUNT);
  assert.equal(childRecord?.name, CHILD_NAME);
  assert.equal(childRecord?.owner, OWNER_ACCOUNT);
}

function baselineAccountCodeHash(accountId: string): string {
  const accounts = baseline.accounts as Record<string, { code_hash?: unknown }> | undefined;
  const codeHash = accounts?.[accountId]?.code_hash;
  if (typeof codeHash !== "string") throw new Error(`Baseline code hash is missing for ${accountId}`);
  return codeHash;
}

function baselineFactoryContracts(): FactoryRecord[] {
  const factory = baseline.factory as { contracts?: unknown } | undefined;
  if (!Array.isArray(factory?.contracts)) throw new Error("Baseline factory registry is missing");
  return factory.contracts as FactoryRecord[];
}

function verifyAllKeychainIdentities(): void {
  verifyKeychainIdentity(NEAR_BINARY, ROOT_ACCOUNT, ROOT_PUBLIC_KEY, NEAR_CONNECTION);
  verifyKeychainIdentity(NEAR_BINARY, AGENT_ACCOUNT, AGENT_PUBLIC_KEY, NEAR_CONNECTION);
  verifyKeychainIdentity(NEAR_BINARY, OWNER_ACCOUNT, OWNER_PUBLIC_KEY, NEAR_CONNECTION);
  verifyKeychainIdentity(NEAR_BINARY, FACTORY_ACCOUNT, FACTORY_PUBLIC_KEY, NEAR_CONNECTION);
}

function accountHash(accountId: string): string {
  return createHash("sha256").update(accountId).digest("hex");
}

function base58Sha256(bytes: Buffer): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digest = createHash("sha256").update(bytes).digest();
  let value = BigInt(`0x${digest.toString("hex")}`);
  let encoded = "";
  while (value > 0n) {
    const remainder = Number(value % 58n);
    encoded = alphabet[remainder] + encoded;
    value /= 58n;
  }
  const padding = digest.findIndex((byte) => byte !== 0);
  return alphabet[0]?.repeat(padding < 0 ? digest.length : padding) + encoded;
}

async function loadState(): Promise<AcceptanceState> {
  try {
    const loaded = JSON.parse(await readFile(STATE_PATH, "utf8")) as AcceptanceState;
    assert.equal(loaded.schema, 1);
    assert.equal(loaded.network, "testnet");
    assert.equal(loaded.factory_account, FACTORY_ACCOUNT);
    assert.equal(loaded.child_name, CHILD_NAME);
    assert.equal(loaded.child_account, CHILD_ACCOUNT);
    return loaded;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    if (!/ENOENT/iu.test(message)) throw reason;
    return {
      child_account: CHILD_ACCOUNT,
      child_name: CHILD_NAME,
      factory_account: FACTORY_ACCOUNT,
      network: "testnet",
      schema: 1,
      transactions: {},
    };
  }
}

async function saveState(): Promise<void> {
  await writePrivateJson(STATE_PATH, state);
  await chmod(STATE_PATH, 0o600);
}
