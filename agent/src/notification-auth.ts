import { createHash } from "node:crypto";

import { serialize } from "borsh";
import { utils } from "near-api-js";

import type { NearRpcClient } from "./near.js";

const NEP_413_TAG = 2_147_484_061;
const AUTH_MAX_AGE_MS = 5 * 60 * 1_000;

const nep413PayloadSchema = {
  struct: {
    tag: "u32",
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" },
  },
} as const;

export interface NotificationAuthorization {
  accountId: string;
  action: string;
  issuedAt: string;
  nonce: string;
  payloadHash: string;
  message: string;
  origin?: string;
  recipient: string;
  callbackUrl?: string;
  publicKey: string;
  signature: string;
}

interface AccessKeyResult {
  permission: "FullAccess" | { FunctionCall: unknown };
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function notificationPayloadHash(payload: unknown): string {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export function buildNotificationAuthorizationMessage(options: {
  accountId: string;
  action: string;
  issuedAt: string;
  nonce: string;
  payloadHash: string;
  origin?: string;
}): string {
  const title = options.action.includes("payroll")
    ? "Clavis private payroll authorization"
    : "Clavis notification authorization";
  return [
    title,
    `version=${options.origin ? "2" : "1"}`,
    `account_id=${options.accountId}`,
    `action=${options.action}`,
    `issued_at=${options.issuedAt}`,
    `nonce=${options.nonce}`,
    `payload_hash=${options.payloadHash}`,
    ...(options.origin ? [`origin=${options.origin}`] : []),
  ].join("\n");
}

export function verifyNotificationSignature(
  authorization: NotificationAuthorization,
): boolean {
  const nonce = Buffer.from(authorization.nonce, "base64");
  if (nonce.length !== 32) return false;

  const payload = serialize(nep413PayloadSchema, {
    tag: NEP_413_TAG,
    message: authorization.message,
    nonce,
    recipient: authorization.recipient,
    callbackUrl: authorization.callbackUrl,
  });
  const digest = createHash("sha256").update(payload).digest();
  const signature = Buffer.from(authorization.signature, "base64");

  try {
    return utils.PublicKey.fromString(authorization.publicKey).verify(digest, signature);
  } catch {
    return false;
  }
}

export async function verifyNotificationAuthorization(options: {
  authorization: NotificationAuthorization;
  action: string;
  payload: unknown;
  expectedRecipient: string;
  allowedOrigins: ReadonlySet<string>;
  rpc: NearRpcClient;
  now?: Date;
}): Promise<void> {
  const { authorization } = options;
  const now = options.now ?? new Date();
  const issuedAt = Date.parse(authorization.issuedAt);
  if (!Number.isFinite(issuedAt) || Math.abs(now.getTime() - issuedAt) > AUTH_MAX_AGE_MS) {
    throw new Error("Notification authorization has expired");
  }
  if (authorization.action !== options.action) {
    throw new Error("Notification authorization action does not match");
  }
  if (authorization.recipient !== options.expectedRecipient) {
    throw new Error("Notification authorization recipient does not match");
  }
  // Version 2 signs the browser origin inside the human-readable message, so
  // injected wallets such as Meteor can omit NEP-413's optional callback URL.
  // Version 1 remains accepted for already-open clients that supplied a
  // callback URL before this protocol revision.
  const authorizationOrigin = authorization.origin
    ? canonicalOrigin(authorization.origin)
    : authorization.callbackUrl
      ? new URL(authorization.callbackUrl).origin
      : null;
  if (!authorizationOrigin) {
    throw new Error("Notification authorization origin is missing");
  }
  if (options.allowedOrigins.size > 0 && !options.allowedOrigins.has(authorizationOrigin)) {
    throw new Error("Notification authorization origin is not allowed");
  }

  const payloadHash = notificationPayloadHash(options.payload);
  if (payloadHash !== authorization.payloadHash) {
    throw new Error("Notification authorization payload does not match");
  }
  const expectedMessage = buildNotificationAuthorizationMessage({
    accountId: authorization.accountId,
    action: options.action,
    issuedAt: authorization.issuedAt,
    nonce: authorization.nonce,
    payloadHash,
    ...(authorization.origin ? { origin: authorization.origin } : {}),
  });
  if (expectedMessage !== authorization.message || !verifyNotificationSignature(authorization)) {
    throw new Error("Notification authorization signature is invalid");
  }

  const accessKey = await options.rpc.rpc<AccessKeyResult>({
    request_type: "view_access_key",
    finality: "final",
    account_id: authorization.accountId,
    public_key: authorization.publicKey,
  });
  if (accessKey.permission !== "FullAccess") {
    throw new Error("Notification linking requires a full-access wallet key");
  }
}

function canonicalOrigin(value: string): string {
  const parsed = new URL(value);
  if (parsed.origin !== value) {
    throw new Error("Notification authorization origin is invalid");
  }
  return parsed.origin;
}
