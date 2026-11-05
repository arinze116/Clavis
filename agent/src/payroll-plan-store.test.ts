import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PayrollPlanStore } from "./payroll-plan-store.js";
import type { PayrollRecipient } from "./types.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function store(): Promise<{ directory: string; plans: PayrollPlanStore }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "clavis-payroll-plans-"));
  directories.push(directory);
  return { directory, plans: new PayrollPlanStore(directory) };
}

function recipient(
  hashCharacter: string,
  overrides: Partial<PayrollRecipient> = {},
): PayrollRecipient {
  return {
    recipientHash: hashCharacter.repeat(64),
    name: `Worker ${hashCharacter}`,
    nearAddress: `worker-${hashCharacter}.testnet`,
    amountYocto: "1000000000000000000000000",
    milestoneReady: false,
    destinations: [
      {
        chain: "near",
        token: "NEAR",
        address: `worker-${hashCharacter}.testnet`,
        percentage: 100,
      },
    ],
    ...overrides,
  };
}

describe("PayrollPlanStore", () => {
  it("syncs a validated private plan without exposing it through the response", async () => {
    const { directory, plans } = await store();
    const result = await plans.sync({
      contractId: "acme.clavis.testnet",
      ownerEmail: "owner@example.com",
      recipients: [recipient("a"), recipient("b")],
    });

    expect(result).toEqual({ recipientCount: 2 });
    const saved = JSON.parse(
      await readFile(path.join(directory, "acme.clavis.testnet.json"), "utf8"),
    ) as { owner_email: string; recipients: PayrollRecipient[] };
    expect(saved.owner_email).toBe("owner@example.com");
    expect(saved.recipients.map((item) => item.recipientHash)).toEqual([
      "a".repeat(64),
      "b".repeat(64),
    ]);
    if (process.platform !== "win32") {
      expect((await stat(path.join(directory, "acme.clavis.testnet.json"))).mode & 0o777).toBe(
        0o600,
      );
    }
  });

  it("serializes concurrent upserts and removes only the selected recipient", async () => {
    const { plans } = await store();
    await Promise.all([
      plans.upsert({ contractId: "acme.clavis.testnet", recipient: recipient("a") }),
      plans.upsert({ contractId: "acme.clavis.testnet", recipient: recipient("b") }),
    ]);

    await plans.upsert({
      contractId: "acme.clavis.testnet",
      recipient: recipient("a", { amountYocto: "2000000000000000000000000" }),
    });
    const removed = await plans.remove({
      contractId: "acme.clavis.testnet",
      recipientHash: "b".repeat(64),
    });
    const saved = await plans.get("acme.clavis.testnet");

    expect(removed).toEqual({ recipientCount: 1, removed: true });
    expect(saved?.recipients).toHaveLength(1);
    expect(saved?.recipients[0]?.amountYocto).toBe("2000000000000000000000000");
  });

  it("rejects malformed routes before writing a plan", async () => {
    const { plans } = await store();
    await expect(
      plans.sync({
        contractId: "acme.clavis.testnet",
        recipients: [
          recipient("a", {
            destinations: [
              {
                chain: "ethereum",
                token: "USDC",
                address: "not-an-evm-address",
                percentage: 100,
              },
            ],
          }),
        ],
      }),
    ).rejects.toThrow();
    await expect(plans.get("acme.clavis.testnet")).resolves.toBeNull();
    await expect(
      plans.sync({ contractId: "unrelated.testnet", recipients: [] }),
    ).rejects.toThrow("Invalid payroll contract ID");
  });
});
