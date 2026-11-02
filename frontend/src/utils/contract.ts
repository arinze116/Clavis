import { JsonRpcProvider } from "@near-js/providers";
import type { Wallet } from "@near-wallet-selector/core";
import { actionCreators } from "@near-js/transactions";

import type {
  AnomalyEntry,
  AuditEntry,
  ContractSnapshot,
  Recipient,
  RecipientDraft,
} from "../types";
import { contractId, rpcEndpoint, rpcUrl } from "./near";
import { nearToYocto } from "./format";

type RpcViewResult = string | number | boolean | object;

const VIEW_CACHE_TTL_MS = 10_000;
const VIEW_DEBOUNCE_MS = 50;
const MAX_VIEW_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 500;

interface CachedViewResult {
  expiresAt: number;
  value: unknown;
}

const viewCache = new Map<string, CachedViewResult>();
const pendingViewRequests = new Map<string, Promise<unknown>>();

const provider = new JsonRpcProvider(
  { url: rpcEndpoint },
  // Retries are handled below so 429 responses only have one backoff policy.
  { retries: 1, wait: 0, backoff: 1 },
);

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function viewCacheKey(methodName: string, args: Record<string, unknown>): string {
  return `${methodName}:${JSON.stringify(args)}`;
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
  methodName: string,
  args: Record<string, unknown>,
): Promise<RpcViewResult> {
  for (let attempt = 0; attempt < MAX_VIEW_ATTEMPTS; attempt += 1) {
    try {
      const result = await provider.callFunction<RpcViewResult>(contractId, methodName, args, {
        finality: "final",
      });
      if (result === undefined) {
        throw new Error("The contract returned an empty response");
      }
      return result;
    } catch (reason) {
      const isFinalAttempt = attempt === MAX_VIEW_ATTEMPTS - 1;
      if (isFinalAttempt || !retryableViewError(reason)) {
        throw reason;
      }
      await wait(INITIAL_BACKOFF_MS * 2 ** attempt);
    }
  }

  throw new Error("The contract view request exhausted its retry attempts");
}

function invalidateViewCache(): void {
  viewCache.clear();
}

export async function view<T>(
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const key = viewCacheKey(methodName, args);
  const cached = cachedView<T>(key);
  if (cached !== undefined) return cached;

  const pending = pendingViewRequests.get(key);
  if (pending) return pending as Promise<T>;

  const request = (async () => {
    // Coalesce Strict Mode and rapid refresh calls before touching the RPC.
    await wait(VIEW_DEBOUNCE_MS);
    const refreshedCache = cachedView<T>(key);
    if (refreshedCache !== undefined) return refreshedCache;

    try {
      const result = await callViewWithBackoff(methodName, args);
      viewCache.set(key, {
        value: result,
        expiresAt: Date.now() + VIEW_CACHE_TTL_MS,
      });
      return result as T;
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Unknown RPC error";
      throw new Error(`Unable to read ${contractId}.${methodName} via ${rpcUrl}: ${detail}`);
    }
  })();

  const trackedRequest = request.finally(() => pendingViewRequests.delete(key));
  pendingViewRequests.set(key, trackedRequest);
  return trackedRequest as Promise<T>;
}

export async function loadContractSnapshot(): Promise<ContractSnapshot> {
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
    view<string>("get_owner"),
    view<string>("get_agent"),
    view<string>("get_daily_limit"),
    view<string>("get_daily_spent"),
    view<string>("get_per_payment_limit"),
    view<string>("get_treasury_balance"),
    view<boolean>("is_paused"),
    view<Recipient[]>("get_recipients", { from: 0, limit: 100 }),
    view<AuditEntry[]>("get_audit_log_reverse", { from: 0, limit: 100 }),
    view<AnomalyEntry[]>("get_anomalies", { from: 0, limit: 100, active_only: false }),
    view<number>("get_log_count"),
  ]);

  return {
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
  };
}

export async function change(
  wallet: Wallet,
  accountId: string,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<void> {
  await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: contractId,
    actions: [actionCreators.functionCall(methodName, args, 100_000_000_000_000n, 0n)],
  });
  invalidateViewCache();
}

export async function hashWalletAddress(address: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address.trim()));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function addRecipient(
  wallet: Wallet,
  accountId: string,
  draft: RecipientDraft,
): Promise<void> {
  const recipientHash = await hashWalletAddress(draft.walletAddress);
  await change(wallet, accountId, "add_recipient", {
    recipient_hash: recipientHash,
    config: {
      name: draft.name.trim(),
      personal_cap: nearToYocto(draft.personalCapNear),
      active: true,
      preferred_chain: draft.preferredChain,
      preferred_token: draft.preferredToken,
      payment_split: [],
      schedule: draft.schedule,
    },
  });
}
