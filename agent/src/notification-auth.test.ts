import { createHash, randomBytes } from "node:crypto";

import { serialize } from "borsh";
import { KeyPair } from "near-api-js";
import { describe, expect, it } from "vitest";

import type { NearRpcClient } from "./near.js";
import {
  buildNotificationAuthorizationMessage,
  notificationPayloadHash,
  type NotificationAuthorization,
  verifyNotificationAuthorization,
  verifyNotificationSignature,
} from "./notification-auth.js";

const schema = {
  struct: {
    tag: "u32",
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" },
  },
} as const;

function authorization(payload: unknown): NotificationAuthorization {
  const keyPair = KeyPair.fromRandom("ED25519");
  const nonceBytes = randomBytes(32);
  const nonce = nonceBytes.toString("base64");
  const issuedAt = "2026-11-03T08:00:00.000Z";
  const payloadHash = notificationPayloadHash(payload);
  const message = buildNotificationAuthorizationMessage({
    accountId: "owner.testnet",
    action: "begin_email_link",
    issuedAt,
    nonce,
    payloadHash,
  });
  const callbackUrl = "https://clavisapp.vercel.app/dashboard";
  const serialized = serialize(schema, {
    tag: 2_147_484_061,
    message,
    nonce: nonceBytes,
    recipient: "factory.clavis.testnet",
    callbackUrl,
  });
  const digest = createHash("sha256").update(serialized).digest();
  const signature = keyPair.sign(digest).signature;
  return {
    accountId: "owner.testnet",
    action: "begin_email_link",
    issuedAt,
    nonce,
    payloadHash,
    message,
    recipient: "factory.clavis.testnet",
    callbackUrl,
    publicKey: keyPair.getPublicKey().toString(),
    signature: Buffer.from(signature).toString("base64"),
  };
}

describe("notification authorization", () => {
  it("verifies an NEP-413 signature and full-access key", async () => {
    const payload = { email: "owner@example.com" };
    const signed = authorization(payload);
    expect(verifyNotificationSignature(signed)).toBe(true);

    const rpc = {
      rpc: async () => ({ permission: "FullAccess" }),
    } as unknown as NearRpcClient;
    await expect(
      verifyNotificationAuthorization({
        authorization: signed,
        action: "begin_email_link",
        payload,
        expectedRecipient: "factory.clavis.testnet",
        allowedOrigins: new Set(["https://clavisapp.vercel.app"]),
        rpc,
        now: new Date("2026-11-03T08:01:00.000Z"),
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects a payload changed after signing", async () => {
    const payload = { email: "owner@example.com" };
    const signed = authorization(payload);
    const rpc = {
      rpc: async () => ({ permission: "FullAccess" }),
    } as unknown as NearRpcClient;
    await expect(
      verifyNotificationAuthorization({
        authorization: signed,
        action: "begin_email_link",
        payload: { email: "attacker@example.com" },
        expectedRecipient: "factory.clavis.testnet",
        allowedOrigins: new Set(["https://clavisapp.vercel.app"]),
        rpc,
        now: new Date("2026-11-03T08:01:00.000Z"),
      }),
    ).rejects.toThrow("payload does not match");
  });
});
