import type { Wallet } from "@near-wallet-selector/core";
import { Buffer } from "buffer";

import { factoryContractId } from "./near";

const STORAGE_PREFIX = "clavis.notificationPreferences.";
const TELEGRAM_LINK_PREFIX = "clavis.pendingTelegramLink.";
const AGENT_SESSION_PREFIX = "clavis.agentSession.";
const DEFAULT_NOTIFICATION_API = "/api/notifications";
const MAX_EVENT_ATTEMPTS = 4;

export interface LinkedNotificationSettings {
  accountId: string;
  email: string | null;
  telegramChatId: string | null;
  sessionToken: string | null;
  sessionExpiresAt: string | null;
  updatedAt: string;
}

export interface EmailLinkChallenge {
  challengeId: string;
  email: string;
  expiresAt: string;
}

export interface PendingTelegramLink {
  pairingId: string;
  pollToken: string;
  connectUrl: string;
  expiresAt: string;
}

interface AgentTransactionSession {
  accountId: string;
  sessionToken: string;
  sessionExpiresAt: string;
}

interface PreferenceResponse {
  preference: {
    accountId: string;
    email: string | null;
    telegramChatId: string | null;
    updatedAt: string;
  };
  sessionToken: string | null;
  sessionExpiresAt: string | null;
}

export type AgentAuthorizationAction =
  | "begin_email_link"
  | "begin_telegram_link"
  | "unlink_notification_channel"
  | "sync_payroll_plan"
  | "upsert_payroll_recipient"
  | "remove_payroll_recipient";

export interface SignedAgentAuthorization {
  accountId: string;
  action: string;
  issuedAt: string;
  nonce: string;
  payloadHash: string;
  message: string;
  origin: string;
  recipient: string;
  callbackUrl?: string;
  publicKey: string;
  signature: string;
}

function storageKey(accountId: string): string {
  return `${STORAGE_PREFIX}${accountId}`;
}

function telegramLinkKey(accountId: string): string {
  return `${TELEGRAM_LINK_PREFIX}${accountId}`;
}

function agentSessionKey(accountId: string): string {
  return `${AGENT_SESSION_PREFIX}${accountId}`;
}

function notificationApiUrl(): string {
  return import.meta.env.VITE_NOTIFICATION_API_URL?.trim() || DEFAULT_NOTIFICATION_API;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nonceBase64(nonce: Uint8Array): string {
  return Buffer.from(nonce).toString("base64");
}

function authorizationMessage(options: {
  accountId: string;
  action: string;
  issuedAt: string;
  nonce: string;
  payloadHash: string;
  origin: string;
}): string {
  const title = options.action.includes("payroll")
    ? "Clavis private payroll authorization"
    : "Clavis notification authorization";
  return [
    title,
    "version=2",
    `account_id=${options.accountId}`,
    `action=${options.action}`,
    `issued_at=${options.issuedAt}`,
    `nonce=${options.nonce}`,
    `payload_hash=${options.payloadHash}`,
    `origin=${options.origin}`,
  ].join("\n");
}

export async function postAgentApi(body: unknown): Promise<Response> {
  return fetch(notificationApiUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
    signal: AbortSignal.timeout(30_000),
  });
}

export async function agentResponseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return new Error(body.error);
  } catch {
    // Use the status fallback when the proxy did not return JSON.
  }
  return new Error(`Clavis private service returned HTTP ${response.status}`);
}

export async function signAgentAuthorization(options: {
  wallet: Wallet;
  accountId: string;
  action: AgentAuthorizationAction;
  payload: unknown;
}): Promise<SignedAgentAuthorization> {
  if (!options.wallet.signMessage) {
    throw new Error("This wallet cannot sign the message required to manage private Clavis settings");
  }

  const issuedAt = new Date().toISOString();
  const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = nonceBase64(nonceBytes);
  const payloadHash = await sha256(stableJson(options.payload));
  const origin = window.location.origin;
  const message = authorizationMessage({
    accountId: options.accountId,
    action: options.action,
    issuedAt,
    nonce,
    payloadHash,
    origin,
  });
  // The wallet-selector Meteor adapter currently drops callbackUrl before it
  // reaches Meteor. Omitting it here keeps the payload we verify byte-for-byte
  // identical to the NEP-413 payload Meteor signs. Redirect wallets still need
  // the callback to return their signature to this page.
  const callbackUrl = options.wallet.id === "meteor-wallet" ? undefined : window.location.href;
  const signed = await options.wallet.signMessage({
    message,
    recipient: factoryContractId,
    nonce: Buffer.from(nonceBytes),
    ...(callbackUrl ? { callbackUrl } : {}),
  });
  if (!signed || signed.accountId !== options.accountId) {
    throw new Error("The connected wallet did not authorize this Clavis settings change");
  }
  return {
    accountId: signed.accountId,
    action: options.action,
    issuedAt,
    nonce,
    payloadHash,
    message,
    origin,
    recipient: factoryContractId,
    ...(callbackUrl ? { callbackUrl } : {}),
    publicKey: signed.publicKey,
    signature: signed.signature,
  };
}

function storePreferenceResponse(
  accountId: string,
  result: PreferenceResponse,
): LinkedNotificationSettings {
  if (result.preference.accountId !== accountId) {
    throw new Error("Notification service returned settings for another wallet");
  }
  const settings: LinkedNotificationSettings = {
    accountId,
    email: result.preference.email,
    telegramChatId: result.preference.telegramChatId,
    sessionToken: result.sessionToken,
    sessionExpiresAt: result.sessionExpiresAt,
    updatedAt: result.preference.updatedAt,
  };
  window.localStorage.setItem(storageKey(accountId), JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("clavis:notification-preferences"));
  return settings;
}

export function getLinkedNotificationSettings(
  accountId: string,
): LinkedNotificationSettings | null {
  try {
    const source = window.localStorage.getItem(storageKey(accountId));
    if (!source) return null;
    const value = JSON.parse(source) as LinkedNotificationSettings;
    return value.accountId === accountId ? value : null;
  } catch {
    window.localStorage.removeItem(storageKey(accountId));
    return null;
  }
}

export async function beginEmailNotificationLink(options: {
  wallet: Wallet;
  accountId: string;
  email: string;
}): Promise<EmailLinkChallenge> {
  const payload = { email: options.email.trim() };
  const action = "begin_email_link" as const;
  const authorization = await signAgentAuthorization({ ...options, action, payload });
  const response = await postAgentApi({ action, payload, authorization });
  if (!response.ok) throw await agentResponseError(response);
  return (await response.json()) as EmailLinkChallenge;
}

export async function confirmEmailNotificationLink(options: {
  accountId: string;
  challengeId: string;
  code: string;
}): Promise<LinkedNotificationSettings> {
  const response = await postAgentApi({
    action: "confirm_email_link",
    payload: {
      challengeId: options.challengeId,
      code: options.code.trim(),
    },
  });
  if (!response.ok) throw await agentResponseError(response);
  return storePreferenceResponse(options.accountId, (await response.json()) as PreferenceResponse);
}

export async function beginTelegramNotificationLink(options: {
  wallet: Wallet;
  accountId: string;
}): Promise<PendingTelegramLink> {
  const payload = {};
  const action = "begin_telegram_link" as const;
  const authorization = await signAgentAuthorization({ ...options, action, payload });
  const response = await postAgentApi({ action, payload, authorization });
  if (!response.ok) throw await agentResponseError(response);
  const pending = (await response.json()) as PendingTelegramLink;
  window.sessionStorage.setItem(telegramLinkKey(options.accountId), JSON.stringify(pending));
  return pending;
}

export function getPendingTelegramLink(accountId: string): PendingTelegramLink | null {
  try {
    const source = window.sessionStorage.getItem(telegramLinkKey(accountId));
    if (!source) return null;
    const pending = JSON.parse(source) as PendingTelegramLink;
    if (Date.parse(pending.expiresAt) <= Date.now()) {
      window.sessionStorage.removeItem(telegramLinkKey(accountId));
      return null;
    }
    return pending;
  } catch {
    window.sessionStorage.removeItem(telegramLinkKey(accountId));
    return null;
  }
}

export function clearPendingTelegramLink(accountId: string): void {
  window.sessionStorage.removeItem(telegramLinkKey(accountId));
}

export async function checkTelegramNotificationLink(options: {
  accountId: string;
  pending: PendingTelegramLink;
}): Promise<LinkedNotificationSettings | null> {
  const response = await postAgentApi({
    action: "telegram_link_status",
    payload: {
      pairingId: options.pending.pairingId,
      pollToken: options.pending.pollToken,
    },
  });
  if (!response.ok) throw await agentResponseError(response);
  const result = (await response.json()) as
    | { status: "PENDING" }
    | ({ status: "CONNECTED" } & PreferenceResponse);
  if (result.status === "PENDING") return null;
  clearPendingTelegramLink(options.accountId);
  return storePreferenceResponse(options.accountId, result);
}

export async function cancelTelegramNotificationLink(options: {
  accountId: string;
  pending: PendingTelegramLink;
}): Promise<void> {
  const response = await postAgentApi({
    action: "cancel_telegram_link",
    payload: {
      pairingId: options.pending.pairingId,
      pollToken: options.pending.pollToken,
    },
  });
  if (!response.ok) throw await agentResponseError(response);
  clearPendingTelegramLink(options.accountId);
}

export async function unlinkNotificationChannel(options: {
  wallet: Wallet;
  accountId: string;
  channel: "email" | "telegram" | "all";
}): Promise<LinkedNotificationSettings> {
  const payload = { channel: options.channel };
  const action = "unlink_notification_channel" as const;
  const authorization = await signAgentAuthorization({ ...options, action, payload });
  const response = await postAgentApi({ action, payload, authorization });
  if (!response.ok) throw await agentResponseError(response);
  if (options.channel === "telegram" || options.channel === "all") {
    clearPendingTelegramLink(options.accountId);
  }
  return storePreferenceResponse(options.accountId, (await response.json()) as PreferenceResponse);
}

export function hasActiveNotificationSession(accountId: string): boolean {
  const settings = getLinkedNotificationSettings(accountId);
  return Boolean(
    settings?.sessionToken &&
      settings.sessionExpiresAt &&
      Date.parse(settings.sessionExpiresAt) > Date.now(),
  );
}

export function storeAgentTransactionSession(options: AgentTransactionSession): void {
  if (Date.parse(options.sessionExpiresAt) <= Date.now()) return;
  window.localStorage.setItem(agentSessionKey(options.accountId), JSON.stringify(options));
}

function getAgentTransactionSession(accountId: string): AgentTransactionSession | null {
  try {
    const source = window.localStorage.getItem(agentSessionKey(accountId));
    if (!source) return null;
    const session = JSON.parse(source) as AgentTransactionSession;
    if (
      session.accountId !== accountId ||
      !session.sessionToken ||
      Date.parse(session.sessionExpiresAt) <= Date.now()
    ) {
      window.localStorage.removeItem(agentSessionKey(accountId));
      return null;
    }
    return session;
  } catch {
    window.localStorage.removeItem(agentSessionKey(accountId));
    return null;
  }
}

export async function notifyTransaction(options: {
  accountId: string;
  receiverId?: string;
  transactionHash: string | null;
}): Promise<void> {
  if (!options.transactionHash) return;
  const settings = getLinkedNotificationSettings(options.accountId);
  const agentSession = getAgentTransactionSession(options.accountId);
  const sessionToken =
    agentSession?.sessionToken ??
    (settings?.sessionToken &&
    settings.sessionExpiresAt &&
    Date.parse(settings.sessionExpiresAt) > Date.now()
      ? settings.sessionToken
      : null);
  if (!sessionToken) return;

  for (let attempt = 0; attempt < MAX_EVENT_ATTEMPTS; attempt += 1) {
    try {
      const response = await postAgentApi({
        action: "transaction_event",
        sessionToken,
        payload: {
          transactionHash: options.transactionHash,
          ...(options.receiverId ? { receiverId: options.receiverId } : {}),
        },
      });
      if (response.ok || response.status === 409) return;
      if (response.status === 401) {
        window.localStorage.removeItem(agentSessionKey(options.accountId));
        window.localStorage.removeItem(storageKey(options.accountId));
        window.dispatchEvent(new CustomEvent("clavis:notification-preferences"));
        return;
      }
    } catch {
      // Transaction submission must never fail because a notification service is unavailable.
    }
    if (attempt < MAX_EVENT_ATTEMPTS - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1_500 * 2 ** attempt));
    }
  }
}

/**
 * Redirect wallets return transaction hashes through the callback URL after a full page
 * navigation. Queue those alerts once the wallet selector has restored the signed-in account.
 */
export function notifyWalletCallbackTransactions(accountId: string): void {
  const url = new URL(window.location.href);
  const values = [
    ...url.searchParams.getAll("transactionHashes"),
    ...url.searchParams.getAll("transactionHashes[]"),
  ];
  const hashes = [
    ...new Set(
      values
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(value)),
    ),
  ];
  if (hashes.length === 0) return;

  url.searchParams.delete("transactionHashes");
  url.searchParams.delete("transactionHashes[]");
  window.history.replaceState(window.history.state, "", url);

  for (const transactionHash of hashes) {
    void notifyTransaction({ accountId, transactionHash });
  }
}
