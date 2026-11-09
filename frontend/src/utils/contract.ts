import { JsonRpcProvider } from "@near-js/providers";
import { actionCreators } from "@near-js/transactions";
import type { Wallet } from "@near-wallet-selector/core";

import type {
  AnomalyEntry,
  AuditEntry,
  ContractEvidence,
  ContractRecord,
  ContractSnapshot,
  Recipient,
  RecipientDraft,
  SecurityAuditResult,
  SecurityAuditScenario,
} from "../types";
import {
  mapPaymentDecisionTransactions,
  type FinalTransactionOutcome,
} from "./audit-transactions";
import {
  explorerUrl,
  factoryContractId,
  nearBlocksApiUrl,
  rootContractId,
  rpcEndpoint,
  rpcUrl,
} from "./near";
import { nearToYocto } from "./format";
import { notifyTransaction } from "./notifications";

type RpcViewResult = string | number | boolean | object;

const ACTIVE_CONTRACT_KEY = "clavis.activeContractId";
const VIEW_CACHE_TTL_MS = 10_000;
const VIEW_DEBOUNCE_MS = 50;
const MAX_VIEW_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 500;
// Required by the factory to create, fund, deploy, and initialize the payroll sub-account.
const FACTORY_DEPLOYMENT_DEPOSIT_YOCTO = 6000000000000000000000000n;
const DEPLOYMENT_TIMEOUT_MS = 90_000;
const AUDIT_LINK_CACHE_TTL_MS = 30_000;

interface CachedViewResult {
  expiresAt: number;
  value: unknown;
}

export interface TransactionSubmission {
  hash: string | null;
  explorerHref: string;
}

export interface SecurityAuditSubmission extends TransactionSubmission {
  results: SecurityAuditResult[];
}

export interface ContractCall {
  methodName: string;
  args?: Record<string, unknown>;
  gas?: bigint;
  deposit?: bigint;
}

const viewCache = new Map<string, CachedViewResult>();
const pendingViewRequests = new Map<string, Promise<unknown>>();
const auditLinkCache = new Map<
  string,
  { expiresAt: number; transactionHashesByPaymentId: Map<number, string> }
>();
const provider = new JsonRpcProvider(
  { url: rpcEndpoint },
  { retries: 1, wait: 0, backoff: 1 },
);

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function viewCacheKey(
  targetContractId: string,
  methodName: string,
  args: Record<string, unknown>,
): string {
  return `${targetContractId}:${methodName}:${JSON.stringify(args)}`;
}

function cachedView<T>(key: string): T | undefined {
  const cached = viewCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    viewCache.delete(key);
    return undefined;
  }
  return cached.value as T;
}

function retryableViewError(reason: unknown): boolean {
  const status =
    typeof reason === "object" && reason !== null && "cause" in reason
      ? (reason as { cause?: unknown }).cause
      : undefined;
  if (status === 408 || status === 429 || (typeof status === "number" && status >= 500)) {
    return true;
  }
  const message = (reason instanceof Error ? reason.message : String(reason)).toLowerCase();
  return ["429", "too many requests", "failed to fetch", "network", "timeout", "unavailable"].some(
    (fragment) => message.includes(fragment),
  );
}

async function callViewWithBackoff(
  targetContractId: string,
  methodName: string,
  args: Record<string, unknown>,
  blockId?: string,
): Promise<RpcViewResult> {
  for (let attempt = 0; attempt < MAX_VIEW_ATTEMPTS; attempt += 1) {
    try {
      const result = await provider.callFunction<RpcViewResult>(
        targetContractId,
        methodName,
        args,
        blockId ? { blockId } : { finality: "final" },
      );
      if (result === undefined) throw new Error("The contract returned an empty response");
      return result;
    } catch (reason) {
      if (attempt === MAX_VIEW_ATTEMPTS - 1 || !retryableViewError(reason)) throw reason;
      await wait(INITIAL_BACKOFF_MS * 2 ** attempt);
    }
  }
  throw new Error("The contract view request exhausted its retry attempts");
}

async function finalContractEvidence(): Promise<ContractEvidence> {
  for (let attempt = 0; attempt < MAX_VIEW_ATTEMPTS; attempt += 1) {
    try {
      const block = await provider.viewBlock({ finality: "final" });
      if (!Number.isSafeInteger(block.header.height) || block.header.height < 0 || !block.header.hash) {
        throw new Error("The RPC returned an invalid final block");
      }
      const blockTimestamp = BigInt(block.header.timestamp_nanosec);
      return {
        source: "NEAR testnet RPC",
        finality: "final",
        observedAt: new Date(Number(blockTimestamp / 1_000_000n)).toISOString(),
        fetchedAt: new Date().toISOString(),
        blockHeight: block.header.height,
        blockHash: block.header.hash,
        blockTimestampNanoseconds: String(block.header.timestamp_nanosec),
      };
    } catch (reason) {
      if (attempt === MAX_VIEW_ATTEMPTS - 1 || !retryableViewError(reason)) throw reason;
      await wait(INITIAL_BACKOFF_MS * 2 ** attempt);
    }
  }
  throw new Error("Unable to resolve a final NEAR block");
}

async function viewAtBlock<T>(
  targetContractId: string,
  methodName: string,
  blockId: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  try {
    return (await callViewWithBackoff(targetContractId, methodName, args, blockId)) as T;
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "Unknown RPC error";
    throw new Error(
      `Unable to read ${targetContractId}.${methodName} at final block ${blockId} via ${rpcUrl}: ${detail}`,
    );
  }
}

async function latestAnomaliesAtBlock(
  contractId: string,
  blockId: string,
  limit = 100,
): Promise<AnomalyEntry[]> {
  const count = await viewAtBlock<number>(contractId, "get_anomaly_count", blockId);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("The contract returned an invalid anomaly count");
  }
  const safeLimit = Math.min(100, Math.max(1, limit));
  return viewAtBlock<AnomalyEntry[]>(contractId, "get_anomalies", blockId, {
    from: Math.max(0, count - safeLimit),
    limit: safeLimit,
    active_only: false,
  });
}

export async function loadLatestAnomalies(
  contractId: string,
  limit = 100,
): Promise<AnomalyEntry[]> {
  const evidence = await finalContractEvidence();
  return latestAnomaliesAtBlock(contractId, evidence.blockHash, limit);
}

function invalidateViewCache(): void {
  viewCache.clear();
}

export async function view<T>(
  targetContractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const key = viewCacheKey(targetContractId, methodName, args);
  const cached = cachedView<T>(key);
  if (cached !== undefined) return cached;
  const pending = pendingViewRequests.get(key);
  if (pending) return pending as Promise<T>;

  const request = (async () => {
    await wait(VIEW_DEBOUNCE_MS);
    const refreshedCache = cachedView<T>(key);
    if (refreshedCache !== undefined) return refreshedCache;
    try {
      const result = await callViewWithBackoff(targetContractId, methodName, args);
      viewCache.set(key, { value: result, expiresAt: Date.now() + VIEW_CACHE_TTL_MS });
      return result as T;
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Unknown RPC error";
      throw new Error(
        `Unable to read ${targetContractId}.${methodName} via ${rpcUrl}: ${detail}`,
      );
    }
  })();
  const trackedRequest = request.finally(() => pendingViewRequests.delete(key));
  pendingViewRequests.set(key, trackedRequest);
  return trackedRequest as Promise<T>;
}

export function getStoredContractId(): string {
  return window.localStorage.getItem(ACTIVE_CONTRACT_KEY) || rootContractId;
}

export function storeContractId(contractId: string): void {
  window.localStorage.setItem(ACTIVE_CONTRACT_KEY, contractId);
}

export async function getContractByOwner(
  owner: string,
  fallbackToRootContract = true,
): Promise<ContractRecord | null> {
  // The original singleton deployment is not indexed by the factory. Prefer
  // it for its actual owner even if that owner later created a factory child,
  // so the canonical demo contract remains reachable and upgradeable.
  if (fallbackToRootContract) {
    try {
      const rootOwner = await view<string>(rootContractId, "get_owner");
      if (rootOwner === owner) {
        return {
          name: rootContractId,
          contract_id: rootContractId,
          owner: rootOwner,
          created_at: 0,
        };
      }
    } catch {
      // A root lookup failure must not hide an otherwise valid factory contract.
    }
  }

  const businessContract = await view<ContractRecord | null>(
    factoryContractId,
    "get_contract_by_owner",
    {
      owner,
    },
  );
  return businessContract;
}

export async function waitForPayrollDeployment(
  owner: string,
  expectedContractId: string,
  timeoutMs = DEPLOYMENT_TIMEOUT_MS,
): Promise<ContractRecord> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const record = (await callViewWithBackoff(
        factoryContractId,
        "get_contract_by_owner",
        { owner },
      )) as ContractRecord | null;
      if (record?.contract_id === expectedContractId) {
        invalidateViewCache();
        return record;
      }
      if (record) {
        throw new Error(`Factory returned unexpected contract ${record.contract_id}`);
      }
    } catch (reason) {
      lastError = reason;
    }
    await wait(1_500);
  }

  const detail = lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new Error(`Deployment was not confirmed within 90 seconds.${detail}`);
}

export async function getAllContracts(): Promise<ContractRecord[]> {
  return view<ContractRecord[]>(factoryContractId, "get_all_contracts");
}

export async function getFactoryContractVersion(): Promise<string | null> {
  try {
    return await view<string>(factoryContractId, "contract_version");
  } catch {
    return null;
  }
}

export function controlsNativeSettlement(contractVersion: string | null): boolean {
  if (!contractVersion) return false;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(contractVersion.trim());
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 0 || minor >= 2;
}

export async function assertFactorySupportsContractControlledSettlement(): Promise<void> {
  const version = await getFactoryContractVersion();
  if (!controlsNativeSettlement(version)) {
    throw new Error(
      "The deployed factory is still on the legacy authorization-only release. Upgrade it to v0.2.0 before creating another payroll contract.",
    );
  }
}

export async function isBusinessNameAvailable(name: string): Promise<boolean> {
  const normalized = name.trim().toLowerCase();
  if (!/^(?!-)[a-z0-9-]{2,32}(?<!-)$/.test(normalized)) return false;
  const registered = await view<boolean>(factoryContractId, "is_name_available", {
    name: normalized,
  });
  if (!registered) return false;
  return !(await accountExists(`${normalized}.clavis.testnet`));
}

async function accountExists(accountId: string): Promise<boolean> {
  const response = await fetch(rpcEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "clavis-account-availability",
      method: "query",
      params: {
        request_type: "view_account",
        finality: "final",
        account_id: accountId,
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Account availability check failed: HTTP ${response.status}`);
  const body = (await response.json()) as {
    result?: unknown;
    error?: { cause?: { name?: string } };
  };
  if (body.result) return true;
  if (body.error?.cause?.name === "UNKNOWN_ACCOUNT") return false;
  throw new Error("Unable to determine whether the business account is available");
}

export async function loadContractSnapshot(contractId: string): Promise<ContractSnapshot> {
  const evidence = await finalContractEvidence();
  const [
    contractVersion,
    owner,
    agent,
    dailyLimit,
    dailySpent,
    lastResetTimestamp,
    perPaymentLimit,
    treasuryBalance,
    paused,
    pendingNativePaymentRecoveryAt,
    recipients,
    auditLog,
    anomalies,
    logCount,
  ] = await Promise.all([
    viewAtBlock<string>(contractId, "contract_version", evidence.blockHash).catch(() => null),
    viewAtBlock<string>(contractId, "get_owner", evidence.blockHash),
    viewAtBlock<string>(contractId, "get_agent", evidence.blockHash),
    viewAtBlock<string>(contractId, "get_daily_limit", evidence.blockHash),
    viewAtBlock<string>(contractId, "get_daily_spent", evidence.blockHash),
    viewAtBlock<string | number>(contractId, "get_last_reset_timestamp", evidence.blockHash),
    viewAtBlock<string>(contractId, "get_per_payment_limit", evidence.blockHash),
    viewAtBlock<string>(contractId, "get_treasury_balance", evidence.blockHash),
    viewAtBlock<boolean>(contractId, "is_paused", evidence.blockHash),
    viewAtBlock<string>(
      contractId,
      "get_pending_native_payment_recovery_at",
      evidence.blockHash,
    ).catch(() => null),
    viewAtBlock<Recipient[]>(contractId, "get_recipients", evidence.blockHash, { from: 0, limit: 100 }),
    viewAtBlock<AuditEntry[]>(contractId, "get_audit_log_reverse", evidence.blockHash, { from: 0, limit: 100 }),
    latestAnomaliesAtBlock(contractId, evidence.blockHash),
    viewAtBlock<number>(contractId, "get_log_count", evidence.blockHash),
  ]);
  const blockTimestamp = timestampNanoseconds(evidence.blockTimestampNanoseconds);
  const resetTimestamp = timestampNanoseconds(lastResetTimestamp);
  if (resetTimestamp > blockTimestamp) {
    throw new Error("The contract authorization window starts after the verified final block");
  }
  const dailyWindowExpired =
    blockTimestamp - resetTimestamp >= 24n * 60n * 60n * 1_000_000_000n;
  return {
    contractId,
    contractVersion,
    contractControlsSettlement: controlsNativeSettlement(contractVersion),
    evidence,
    owner,
    agent,
    dailyLimit,
    dailySpent: dailyWindowExpired ? "0" : dailySpent,
    storedDailySpent: dailySpent,
    dailyWindowExpired,
    lastResetTimestampNanoseconds: resetTimestamp.toString(),
    perPaymentLimit,
    treasuryBalance,
    paused,
    pendingNativePaymentRecoveryAt,
    recipients,
    auditLog,
    anomalies,
    logCount,
  };
}

export interface AuditSnapshot {
  contractId: string;
  evidence: ContractEvidence;
  auditLog: AuditEntry[];
  logCount: number;
}

export async function loadAuditSnapshot(contractId: string): Promise<AuditSnapshot> {
  const evidence = await finalContractEvidence();
  const [auditLog, logCount] = await Promise.all([
    viewAtBlock<AuditEntry[]>(contractId, "get_audit_log_reverse", evidence.blockHash, { from: 0, limit: 100 }),
    viewAtBlock<number>(contractId, "get_log_count", evidence.blockHash),
  ]);
  return { contractId, evidence, auditLog, logCount };
}

export async function enrichAuditSnapshot(snapshot: AuditSnapshot): Promise<AuditSnapshot> {
  const auditLog = await enrichAuditTransactions(snapshot.auditLog, snapshot.contractId);
  return auditLog === snapshot.auditLog ? snapshot : { ...snapshot, auditLog };
}

export async function enrichContractSnapshotAudit(
  snapshot: ContractSnapshot,
): Promise<ContractSnapshot> {
  const auditLog = await enrichAuditTransactions(snapshot.auditLog, snapshot.contractId);
  return auditLog === snapshot.auditLog ? snapshot : { ...snapshot, auditLog };
}

interface NearBlocksReceipt {
  transaction_hash?: string;
  predecessor_account_id?: string;
  receiver_account_id?: string;
  actions?: Array<{ action?: string; method?: string | null }>;
}

interface NearBlocksReceiptResponse {
  data?: NearBlocksReceipt[];
}

export async function enrichAuditTransactions(
  entries: AuditEntry[],
  targetContractId: string,
): Promise<AuditEntry[]> {
  if (entries.length === 0 || entries.every((entry) => entry.transaction_hash)) {
    return entries;
  }

  try {
    const hashesByPaymentId = await loadAuditTransactionHashes(
      targetContractId,
      new Set(
        entries
          .filter((entry) => !entry.transaction_hash)
          .map((entry) => entry.payment_id),
      ),
    );
    return entries.map((entry) => {
      if (entry.transaction_hash) return entry;
      const transactionHash = hashesByPaymentId.get(entry.payment_id);
      return transactionHash ? { ...entry, transaction_hash: transactionHash } : entry;
    });
  } catch {
    // Explorer enrichment is best-effort and must never block contract state.
    return entries;
  }
}

async function loadAuditTransactionHashes(
  targetContractId: string,
  neededPaymentIds: ReadonlySet<number>,
): Promise<Map<number, string>> {
  const cached = auditLinkCache.get(targetContractId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.transactionHashesByPaymentId;
  }

  const methods = ["request_payment", "run_security_audit"] as const;
  const receiptsByMethod = await Promise.all(
    methods.map(async (methodName) => {
      const url = new URL(
        `/v3/accounts/${encodeURIComponent(targetContractId)}/receipts`,
        nearBlocksApiUrl,
      );
      url.searchParams.set("method", methodName);
      url.searchParams.set("limit", "100");
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        throw new Error(`NearBlocks receipt lookup failed with HTTP ${response.status}`);
      }
      const body = (await response.json()) as NearBlocksReceiptResponse;
      return { methodName, receipts: body.data ?? [] };
    }),
  );

  const transactionRequests = new Map<
    string,
    { transactionHash: string; senderAccountId: string }
  >();
  for (const { methodName, receipts } of receiptsByMethod) {
    for (const receipt of receipts) {
      const transactionHash = receipt.transaction_hash;
      const senderAccountId = receipt.predecessor_account_id;
      const isExpectedCall = receipt.actions?.some(
        (action) => action.action === "FUNCTION_CALL" && action.method === methodName,
      );
      if (
        !transactionHash ||
        !senderAccountId ||
        receipt.receiver_account_id !== targetContractId ||
        !isExpectedCall
      ) {
        continue;
      }
      transactionRequests.set(transactionHash, { transactionHash, senderAccountId });
    }
  }

  const candidates = [...transactionRequests.values()];
  const transactionHashesByPaymentId = new Map<number, string>();
  for (let index = 0; index < candidates.length; index += 6) {
    const results = await Promise.allSettled(
      candidates.slice(index, index + 6).map(loadFinalTransactionOutcome),
    );
    const mapped = mapPaymentDecisionTransactions(
      results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
      targetContractId,
    );
    for (const [paymentId, transactionHash] of mapped) {
      transactionHashesByPaymentId.set(paymentId, transactionHash);
    }
    if ([...neededPaymentIds].every((paymentId) => transactionHashesByPaymentId.has(paymentId))) {
      break;
    }
  }

  auditLinkCache.set(targetContractId, {
    expiresAt: Date.now() + AUDIT_LINK_CACHE_TTL_MS,
    transactionHashesByPaymentId,
  });
  return transactionHashesByPaymentId;
}

async function loadFinalTransactionOutcome(options: {
  transactionHash: string;
  senderAccountId: string;
}): Promise<FinalTransactionOutcome> {
  const response = await fetch(rpcEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "clavis-audit-transaction",
      method: "tx",
      params: {
        tx_hash: options.transactionHash,
        sender_account_id: options.senderAccountId,
        wait_until: "FINAL",
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`NEAR transaction lookup failed with HTTP ${response.status}`);
  }
  const body = (await response.json()) as {
    result?: FinalTransactionOutcome;
    error?: { message?: string };
  };
  if (!body.result) {
    throw new Error(body.error?.message ?? "NEAR transaction lookup returned no result");
  }
  return body.result;
}

export async function change(
  wallet: Wallet,
  accountId: string,
  targetContractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<TransactionSubmission> {
  return changeMany(wallet, accountId, targetContractId, [
    { methodName, args },
  ]);
}

export async function changeMany(
  wallet: Wallet,
  accountId: string,
  targetContractId: string,
  calls: ContractCall[],
): Promise<TransactionSubmission> {
  if (calls.length === 0) throw new Error("At least one contract call is required");
  const outcome = await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: targetContractId,
    actions: calls.map((call) =>
      actionCreators.functionCall(
        call.methodName,
        call.args ?? {},
        call.gas ?? 60_000_000_000_000n,
        call.deposit ?? 0n,
      ),
    ),
  });
  invalidateViewCache();
  const submission = transactionSubmission(outcome, targetContractId);
  void notifyTransaction({
    accountId,
    receiverId: targetContractId,
    transactionHash: submission.hash,
  });
  return submission;
}

export async function runSecurityAudit(
  wallet: Wallet,
  accountId: string,
  targetContractId: string,
): Promise<SecurityAuditSubmission> {
  invalidateViewCache();
  const baselineLogCount = await view<number>(targetContractId, "get_log_count");
  if (!Number.isSafeInteger(baselineLogCount) || baselineLogCount < 0) {
    throw new Error("The contract returned an invalid audit-log count");
  }
  const outcome = await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: targetContractId,
    actions: [
      actionCreators.functionCall(
        "run_security_audit",
        {},
        100_000_000_000_000n,
        0n,
      ),
    ],
  });
  invalidateViewCache();
  const submission = transactionSubmission(outcome, targetContractId);
  void notifyTransaction({
    accountId,
    receiverId: targetContractId,
    transactionHash: submission.hash,
  });

  const results =
    securityResultsFromOutcome(outcome) ??
    (await waitForSecurityAuditResults(targetContractId, baselineLogCount));
  if (!results) {
    throw new Error(
      "The security audit transaction confirmed, but its five on-chain results could not be verified.",
    );
  }
  return { ...submission, results };
}

const securityScenarioOrder: SecurityAuditScenario[] = [
  "UNAPPROVED_RECIPIENT",
  "OVER_LIMIT_PAYMENT",
  "SUSPENDED_RECIPIENT",
  "DAILY_LIMIT_BREACH",
  "OFF_HOURS_PAYMENT",
];

const securityReasonFragments = [
  "Recipient not approved",
  "Exceeds per-payment limit",
  "Recipient suspended",
  "Daily limit exceeded",
  "Off-hours payment blocked",
] as const;

function securityResultsFromOutcome(outcome: unknown): SecurityAuditResult[] | null {
  if (typeof outcome !== "object" || outcome === null || !("status" in outcome)) return null;
  const status = (outcome as { status?: unknown }).status;
  if (typeof status !== "object" || status === null || !("SuccessValue" in status)) return null;
  const encoded = (status as { SuccessValue?: unknown }).SuccessValue;
  if (typeof encoded !== "string" || !encoded) return null;
  try {
    const bytes = Uint8Array.from(window.atob(encoded), (character) => character.charCodeAt(0));
    return normalizeSecurityResults(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
  } catch {
    return null;
  }
}

function normalizeSecurityResults(value: unknown): SecurityAuditResult[] | null {
  if (!Array.isArray(value) || value.length !== securityScenarioOrder.length) return null;
  const results = value.flatMap((item, index) => {
    if (typeof item !== "object" || item === null) return [];
    const candidate = item as Partial<SecurityAuditResult>;
    if (
      candidate.scenario !== securityScenarioOrder[index] ||
      typeof candidate.blocked !== "boolean" ||
      typeof candidate.reason !== "string" ||
      typeof candidate.payment_id !== "number"
    ) {
      return [];
    }
    return [candidate as SecurityAuditResult];
  });
  return results.length === securityScenarioOrder.length ? results : null;
}

async function waitForSecurityAuditResults(
  targetContractId: string,
  baselineLogCount: number,
): Promise<SecurityAuditResult[] | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    invalidateViewCache();
    try {
      const entries = await view<AuditEntry[]>(targetContractId, "get_audit_log_reverse", {
        from: 0,
        limit: 20,
      });
      const candidates = entries
        .flatMap((entry) => {
          const reason = rejectedReason(entry);
          return reason?.startsWith("Security audit:") ? [{ entry, reason }] : [];
        })
        .filter(({ entry }) => entry.payment_id > baselineLogCount)
        .sort((left, right) => left.entry.payment_id - right.entry.payment_id);
      for (let start = 0; start <= candidates.length - securityScenarioOrder.length; start += 1) {
        const group = candidates.slice(start, start + securityScenarioOrder.length);
        const verified: SecurityAuditResult[] = [];
        for (let index = 0; index < securityScenarioOrder.length; index += 1) {
          const candidate = group[index];
          const scenario = securityScenarioOrder[index];
          const expectedReason = securityReasonFragments[index];
          const previous = index > 0 ? group[index - 1] : null;
          if (
            !candidate ||
            !scenario ||
            !expectedReason ||
            !candidate.reason.includes(expectedReason) ||
            (previous && candidate.entry.payment_id !== previous.entry.payment_id + 1)
          ) {
            verified.length = 0;
            break;
          }
          verified.push({
            scenario,
            blocked: true,
            reason: candidate.reason,
            payment_id: candidate.entry.payment_id,
          });
        }
        if (verified.length === securityScenarioOrder.length) return verified;
      }
    } catch {
      // The transaction can be final before a selected RPC endpoint serves the new state.
    }
    await wait(600 * (attempt + 1));
  }
  return null;
}

function rejectedReason(entry: AuditEntry): string | null {
  return typeof entry.outcome === "object" && entry.outcome !== null && "Rejected" in entry.outcome
    ? String(entry.outcome.Rejected)
    : null;
}

export async function createPayroll(options: {
  wallet: Wallet;
  accountId: string;
  name: string;
  agent: string;
  dailyLimitNear: string;
  perPaymentLimitNear: string;
}): Promise<TransactionSubmission> {
  const outcome = await options.wallet.signAndSendTransaction({
    signerId: options.accountId,
    receiverId: factoryContractId,
    actions: [
      actionCreators.functionCall(
        "create_payroll",
        {
          name: options.name.trim().toLowerCase(),
          owner: options.accountId,
          agent: options.agent.trim().toLowerCase(),
          daily_limit: nearToYocto(options.dailyLimitNear),
          per_payment_limit: nearToYocto(options.perPaymentLimitNear),
        },
        300_000_000_000_000n,
        FACTORY_DEPLOYMENT_DEPOSIT_YOCTO,
      ),
    ],
  });
  invalidateViewCache();
  const submission = transactionSubmission(outcome, factoryContractId);
  void notifyTransaction({
    accountId: options.accountId,
    receiverId: factoryContractId,
    transactionHash: submission.hash,
  });
  return submission;
}

export async function addRecipients(
  wallet: Wallet,
  accountId: string,
  targetContractId: string,
  recipients: RecipientDraft[],
): Promise<TransactionSubmission[]> {
  const submissions: TransactionSubmission[] = [];
  for (let index = 0; index < recipients.length; index += 6) {
    const chunk = recipients.slice(index, index + 6);
    const actions = await Promise.all(
      chunk.map(async (draft) =>
        actionCreators.functionCall(
          "add_recipient",
          await recipientArgs(draft),
          40_000_000_000_000n,
          0n,
        ),
      ),
    );
    const outcome = await wallet.signAndSendTransaction({
      signerId: accountId,
      receiverId: targetContractId,
      actions,
    });
    const submission = transactionSubmission(outcome, targetContractId);
    submissions.push(submission);
    void notifyTransaction({
      accountId,
      receiverId: targetContractId,
      transactionHash: submission.hash,
    });
  }
  invalidateViewCache();
  return submissions;
}

export async function hashWalletAddress(address: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(address.trim()),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function addRecipient(
  wallet: Wallet,
  accountId: string,
  targetContractId: string,
  draft: RecipientDraft,
): Promise<TransactionSubmission> {
  return change(
    wallet,
    accountId,
    targetContractId,
    "add_recipient",
    await recipientArgs(draft),
  );
}

async function recipientArgs(draft: RecipientDraft): Promise<Record<string, unknown>> {
  return {
    recipient_hash: await hashWalletAddress(draft.walletAddress),
    config: {
      name: draft.name.trim(),
      personal_cap: nearToYocto(draft.personalCapNear),
      active: true,
      preferred_chain: draft.preferredChain,
      preferred_token: draft.preferredToken,
      payment_split: [],
      schedule: draft.schedule,
    },
  };
}

function transactionSubmission(
  outcome: unknown,
  fallbackContractId: string,
): TransactionSubmission {
  const hash =
    typeof outcome === "object" &&
    outcome !== null &&
    "transaction" in outcome &&
    typeof (outcome as { transaction?: { hash?: unknown } }).transaction?.hash === "string"
      ? (outcome as { transaction: { hash: string } }).transaction.hash
      : null;
  return {
    hash,
    explorerHref: hash
      ? `${explorerUrl}/txns/${hash}`
      : `${explorerUrl}/address/${fallbackContractId}`,
  };
}

function timestampNanoseconds(value: unknown): bigint {
  try {
    const timestamp = BigInt(String(value));
    if (timestamp < 0n) throw new Error("negative timestamp");
    return timestamp;
  } catch {
    throw new Error("The contract returned an invalid nanosecond timestamp");
  }
}
