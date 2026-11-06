import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { NotificationEventStore } from "./notification-event-store.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createStore(): Promise<{ store: NotificationEventStore; statePath: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "clavis-notification-events-"));
  directories.push(directory);
  const statePath = path.join(directory, "events.json");
  const store = new NotificationEventStore(statePath);
  await store.load();
  return { store, statePath };
}

describe("NotificationEventStore", () => {
  it("baselines historical events and claims each new event only once", async () => {
    const { store } = await createStore();
    await store.baseline("acme.clavis.testnet", [1, 2], [7]);

    await expect(store.claimDecision("acme.clavis.testnet", 2)).resolves.toBe(false);
    await expect(store.claimDecision("acme.clavis.testnet", 3)).resolves.toBe(true);
    await expect(store.claimDecision("acme.clavis.testnet", 3)).resolves.toBe(false);
    await expect(store.claimAnomaly("acme.clavis.testnet", 8)).resolves.toBe(true);
    await expect(store.claimAnomaly("acme.clavis.testnet", 8)).resolves.toBe(false);
  });

  it("persists claimed events across agent restarts", async () => {
    const { store, statePath } = await createStore();
    await store.baseline("acme.clavis.testnet", [], []);
    await expect(store.claimDecision("acme.clavis.testnet", 12)).resolves.toBe(true);

    const restarted = new NotificationEventStore(statePath);
    await restarted.load();
    await expect(restarted.claimDecision("acme.clavis.testnet", 12)).resolves.toBe(false);
  });
});
