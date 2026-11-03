import { JsonRpcProvider } from "@near-js/providers";
import { actionCreators } from "@near-js/transactions";
import type { Wallet } from "@near-wallet-selector/core";

import type {
  AnomalyEntry,
  AuditEntry,
  ContractRecord,
  ContractSnapshot,
  Recipient,
  RecipientDraft,
} from "../types";
import {
  explorerUrl,
  factoryContractId,
  nearBlocksApiUrl,
  rootContractId,
  rpcEndpoint,
  rpcUrl,
} from "./near";
import { nearToYocto } from "./format";

type RpcViewResult = string | number | boolean | object;

const ACTIVE_CONTRACT_KEY = "clavis.activeContractId";
const VIEW_CACHE_TTL_MS = 10_000;
const VIEW_DEBOUNCE_MS = 50;
const MAX_VIEW_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 500;
const DEPLOYMENT_DEPOSIT = 6_000_000_000_000_000_000_000_000n;
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

const viewCache = new Map<string, CachedViewResult>();
const pendingViewRequests = new Map<string, Promise<unknown>>();
const auditLinkCache = new Map<
  string,
  { expiresAt: number; transactionHashesByBlock: Map<string, string[]> }
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
): Promise<RpcViewResult> {
  for (let attempt = 0; attempt < MAX_VIEW_ATTEMPTS; attempt += 1) {
    try {
      const result = await provider.callFunction<RpcViewResult>(
        targetContractId,
        methodName,
        args,
        { finality: "final" },
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

export async function getContractByOwner(owner: string): Promise<ContractRecord | null> {
  return view<ContractRecord | null>(factoryContractId, "get_contract_by_owner", {
    owner,
  });
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
  const [
    owner,
    agent,
    dailyLimit,
    dailySpent,
    perPaymentLimit,
    treasuryBalance,
    paused,
    recipients,
    auditLog,
    anomalies,
    logCount,
  ] = await Promise.all([
    view<string>(contractId, "get_owner"),
    view<string>(contractId, "get_agent"),
    view<string>(contractId, "get_daily_limit"),
    view<string>(contractId, "get_daily_spent"),
    view<string>(contractId, "get_per_payment_limit"),
    view<string>(contractId, "get_treasury_balance"),
    view<boolean>(contractId, "is_paused"),
    view<Recipient[]>(contractId, "get_recipients", { from: 0, limit: 100 }),
    view<AuditEntry[]>(contractId, "get_audit_log_reverse", { from: 0, limit: 100 }),
    view<AnomalyEntry[]>(contractId, "get_anomalies", {
      from: 0,
      limit: 100,
      active_only: false,
    }),
    view<number>(contractId, "get_log_count"),
  ]);
  return {
    contractId,
    owner,
    agent,
    dailyLimit,
    dailySpent,
    perPaymentLimit,
    treasuryBalance,
    paused,
    recipients,
    auditLog: await enrichAuditTransactions(auditLog, contractId),
    anomalies,
    logCount,
  };
}

interface NearBlocksReceipt {
  transaction_hash?: string;
  receiver_account_id?: string;
  block?: { block_height?: string | number };
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
    const hashesByBlock = await loadAuditTransactionHashes(targetContractId);
    const available = new Map(
      [...hashesByBlock.entries()].map(([height, hashes]) => [height, [...hashes]]),
    );
    return entries.map((entry) => {
      if (entry.transaction_hash) return entry;
      const hashes = available.get(String(entry.block_height));
      const transactionHash = hashes?.shift();
      return transactionHash ? { ...entry, transaction_hash: transactionHash } : entry;
    });
  } catch {
    // Explorer enrichment is best-effort and must never block contract state.
    return entries;
  }
}

async function loadAuditTransactionHashes(
  targetContractId: string,
): Promise<Map<string, string[]>> {
  const cached = auditLinkCache.get(targetContractId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.transactionHashesByBlock;
  }

  const url = new URL(
    `/v3/accounts/${encodeURIComponent(targetContractId)}/receipts`,
    nearBlocksApiUrl,
  );
  url.searchParams.set("method", "request_payment");
  url.searchParams.set("limit", "100");
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`NearBlocks receipt lookup failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as NearBlocksReceiptResponse;
  const transactionHashesByBlock = new Map<string, string[]>();
  for (const receipt of body.data ?? []) {
    const height = receipt.block?.block_height;
    const transactionHash = receipt.transaction_hash;
    const isPaymentRequest = receipt.actions?.some(
      (action) => action.action === "FUNCTION_CALL" && action.method === "request_payment",
    );
    if (
      height === undefined ||
      !transactionHash ||
      receipt.receiver_account_id !== targetContractId ||
      !isPaymentRequest
    ) {
      continue;
    }
    const key = String(height);
    const hashes = transactionHashesByBlock.get(key) ?? [];
    if (!hashes.includes(transactionHash)) hashes.push(transactionHash);
    transactionHashesByBlock.set(key, hashes);
  }

  auditLinkCache.set(targetContractId, {
    expiresAt: Date.now() + AUDIT_LINK_CACHE_TTL_MS,
    transactionHashesByBlock,
  });
  return transactionHashesByBlock;
}

export async function change(
  wallet: Wallet,
  accountId: string,
  targetContractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<TransactionSubmission> {
  const outcome = await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: targetContractId,
    actions: [actionCreators.functionCall(methodName, args, 100_000_000_000_000n, 0n)],
  });
  invalidateViewCache();
  return transactionSubmission(outcome, targetContractId);
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
        DEPLOYMENT_DEPOSIT,
      ),
    ],
  });
  invalidateViewCache();
  return transactionSubmission(outcome, factoryContractId);
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
    submissions.push(transactionSubmission(outcome, targetContractId));
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
