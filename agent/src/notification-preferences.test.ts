import { mkdtemp, readFile, rm } from "node:fs/promises";
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
});
