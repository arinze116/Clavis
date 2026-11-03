import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { NotificationPreferenceStore } from "./notification-preferences.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function store(): Promise<{ store: NotificationPreferenceStore; filePath: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "clavis-notifications-"));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, "preferences.json");
  const store = new NotificationPreferenceStore(filePath);
  await store.load();
  return { store, filePath };
}

describe("NotificationPreferenceStore", () => {
  it("migrates the original preference file without losing linked channels", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "clavis-notifications-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "preferences.json");
    await writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        preferences: {
          "owner.testnet": {
            accountId: "owner.testnet",
            email: "owner@example.com",
            telegramChatId: null,
            updatedAt: "2026-11-03T08:00:00.000Z",
          },
        },
        sessions: {},
        processedEvents: {},
      }),
    );

    const migrated = new NotificationPreferenceStore(filePath);
    await migrated.load();
    expect(migrated.get("owner.testnet")).toMatchObject({
      email: "owner@example.com",
    });
    expect(migrated.getTelegramUpdateOffset()).toBe(0);
  });

  it("persists linked channels and authenticates an opaque session", async () => {
    const fixture = await store();
    await fixture.store.set({
      accountId: "owner.testnet",
      email: "owner@example.com",
      telegramChatId: "123456789",
    });
    const session = await fixture.store.issueSession("owner.testnet", 60_000);

    expect(fixture.store.authenticateSession(session.token)).toBe("owner.testnet");
    expect(fixture.store.authenticateSession("invalid-session-token-that-is-long-enough")).toBeNull();

    const reloaded = new NotificationPreferenceStore(fixture.filePath);
    await reloaded.load();
    expect(reloaded.get("owner.testnet")).toMatchObject({
      email: "owner@example.com",
      telegramChatId: "123456789",
    });
    expect(reloaded.authenticateSession(session.token)).toBe("owner.testnet");

    const persisted = JSON.parse(await readFile(fixture.filePath, "utf8")) as {
      sessions: Record<string, unknown>;
    };
    expect(JSON.stringify(persisted)).not.toContain(session.token);
    expect(Object.keys(persisted.sessions)).toHaveLength(1);
  });

  it("deduplicates processed transaction and authorization events", async () => {
    const fixture = await store();
    expect(fixture.store.hasProcessedEvent("owner.testnet:transaction")).toBe(false);
    await fixture.store.markEventProcessed("owner.testnet:transaction");
    expect(fixture.store.hasProcessedEvent("owner.testnet:transaction")).toBe(true);
  });

  it("links an email only after the one-time verification code is confirmed", async () => {
    const fixture = await store();
    const challenge = await fixture.store.createEmailChallenge(
      "owner.testnet",
      "owner@example.com",
      60_000,
    );
    const wrongCode = challenge.code === "999999" ? "000000" : "999999";

    await expect(
      fixture.store.confirmEmailChallenge(challenge.challengeId, wrongCode),
    ).rejects.toThrow("invalid or expired");
    await expect(
      fixture.store.confirmEmailChallenge(challenge.challengeId, challenge.code),
    ).resolves.toMatchObject({
      accountId: "owner.testnet",
      email: "owner@example.com",
      telegramChatId: null,
    });

    const persisted = await readFile(fixture.filePath, "utf8");
    expect(persisted).not.toContain(challenge.challengeId);
    expect(persisted).not.toContain(challenge.code);
  });

  it("pairs Telegram through separate bot and browser secrets", async () => {
    const fixture = await store();
    const pairing = await fixture.store.createTelegramPairing("owner.testnet", 60_000);

    expect(
      fixture.store.getTelegramPairingStatus(pairing.pairingId, pairing.pollToken),
    ).toMatchObject({ status: "PENDING", accountId: "owner.testnet" });
    await expect(
      fixture.store.completeTelegramPairing(pairing.startToken, "123456789"),
    ).resolves.toMatchObject({
      newlyConnected: true,
      preference: {
        accountId: "owner.testnet",
        telegramChatId: "123456789",
      },
    });
    expect(
      fixture.store.getTelegramPairingStatus(pairing.pairingId, pairing.pollToken),
    ).toMatchObject({
      status: "CONNECTED",
      preference: { telegramChatId: "123456789" },
    });

    const persisted = await readFile(fixture.filePath, "utf8");
    expect(persisted).not.toContain(pairing.startToken);
    expect(persisted).not.toContain(pairing.pollToken);

    const cancelled = await fixture.store.createTelegramPairing("owner.testnet", 60_000);
    await fixture.store.cancelTelegramPairing(cancelled.pairingId, cancelled.pollToken);
    expect(() =>
      fixture.store.getTelegramPairingStatus(cancelled.pairingId, cancelled.pollToken),
    ).toThrow("invalid or expired");
  });
});
