import { Buffer } from "buffer";
import type { Wallet } from "@near-wallet-selector/core";

import { factoryContractId } from "./near";

const STORAGE_PREFIX = "clavis.notificationPreferences.";
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

interface LinkResponse {
  preference: {
    accountId: string;
    email: string | null;
    telegramChatId: string | null;
    updatedAt: string;
  };
  sessionToken: string | null;
  sessionExpiresAt: string | null;
}

function storageKey(accountId: string): string {
  return `${STORAGE_PREFIX}${accountId}`;
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
}): string {
  return [
    "Clavis notification authorization",
    "version=1",
    `account_id=${options.accountId}`,
    `action=${options.action}`,
    `issued_at=${options.issuedAt}`,
    `nonce=${options.nonce}`,
    `payload_hash=${options.payloadHash}`,
  ].join("\n");
}

async function postNotificationApi(body: unknown): Promise<Response> {
  return fetch(notificationApiUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
    signal: AbortSignal.timeout(30_000),
  });
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return new Error(body.error);
  } catch {
    // Use the status fallback below when the proxy did not return JSON.
  }
  return new Error(`Notification service returned HTTP ${response.status}`);
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
    return null;
  }
}

export async function linkNotificationSettings(options: {
  wallet: Wallet;
  accountId: string;
  email: string | null;
  telegramChatId: string | null;
}): Promise<LinkedNotificationSettings> {
  if (!options.wallet.signMessage) {
    throw new Error("This wallet cannot sign the message required to link notifications");
  }

  const payload = {
    email: options.email?.trim() || null,
    telegramChatId: options.telegramChatId?.trim() || null,
  };
  const action = "save_preferences";
  const issuedAt = new Date().toISOString();
  const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = nonceBase64(nonceBytes);
  const payloadHash = await sha256(stableJson(payload));
  const message = authorizationMessage({
    accountId: options.accountId,
    action,
    issuedAt,
    nonce,
    payloadHash,
  });
  const callbackUrl = window.location.href;
  const signed = await options.wallet.signMessage({
    message,
    recipient: factoryContractId,
    nonce: Buffer.from(nonceBytes),
    callbackUrl,
  });
  if (!signed || signed.accountId !== options.accountId) {
    throw new Error("The connected wallet did not authorize notification linking");
  }

  const response = await postNotificationApi({
    action,
    payload,
    authorization: {
      accountId: signed.accountId,
      action,
      issuedAt,
      nonce,
      payloadHash,
      message,
      recipient: factoryContractId,
      callbackUrl,
      publicKey: signed.publicKey,
      signature: signed.signature,
    },
  });
  if (!response.ok) throw await responseError(response);
  const result = (await response.json()) as LinkResponse;
  const settings: LinkedNotificationSettings = {
    accountId: result.preference.accountId,
    email: result.preference.email,
    telegramChatId: result.preference.telegramChatId,
    sessionToken: result.sessionToken,
    sessionExpiresAt: result.sessionExpiresAt,
    updatedAt: result.preference.updatedAt,
  };
  window.localStorage.setItem(storageKey(options.accountId), JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("clavis:notification-preferences"));
  return settings;
}

export function hasActiveNotificationSession(accountId: string): boolean {
  const settings = getLinkedNotificationSettings(accountId);
  return Boolean(
    settings?.sessionToken &&
      settings.sessionExpiresAt &&
      Date.parse(settings.sessionExpiresAt) > Date.now(),
  );
}

export async function notifyTransaction(options: {
  accountId: string;
  receiverId?: string;
  transactionHash: string | null;
}): Promise<void> {
  if (!options.transactionHash) return;
  const settings = getLinkedNotificationSettings(options.accountId);
  if (
    !settings?.sessionToken ||
    !settings.sessionExpiresAt ||
    Date.parse(settings.sessionExpiresAt) <= Date.now()
  ) {
    return;
  }

  for (let attempt = 0; attempt < MAX_EVENT_ATTEMPTS; attempt += 1) {
    try {
      const response = await postNotificationApi({
        action: "transaction_event",
        sessionToken: settings.sessionToken,
        payload: {
          transactionHash: options.transactionHash,
          ...(options.receiverId ? { receiverId: options.receiverId } : {}),
        },
      });
      if (response.ok || response.status === 409) return;
      if (response.status === 401) {
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
