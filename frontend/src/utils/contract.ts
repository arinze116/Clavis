import type { Wallet } from "@near-wallet-selector/core";
import { actionCreators } from "@near-js/transactions";

import type {
  AnomalyEntry,
  AuditEntry,
  ContractSnapshot,
  Recipient,
  RecipientDraft,
} from "../types";
import { contractId, rpcUrl } from "./near";
import { nearToYocto } from "./format";

interface RpcResponse<T> {
  result?: T;
  error?: { message?: string };
}

interface CallResult {
  result: number[];
}

export async function view<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `clavis-${methodName}`,
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: contractId,
        method_name: methodName,
        args_base64: btoa(JSON.stringify(args)),
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`NEAR RPC returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as RpcResponse<CallResult>;
  if (!body.result || body.error) {
    throw new Error(body.error?.message ?? "Unable to read the Clavis contract");
  }
  return JSON.parse(new TextDecoder().decode(new Uint8Array(body.result.result))) as T;
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
