import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  PayrollPlanStore,
  type ExpectedRecipientPolicy,
  type PendingPayrollOperation,
} from "./payroll-plan-store.js";
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

function expectedPolicy(
  overrides: Partial<ExpectedRecipientPolicy> = {},
): ExpectedRecipientPolicy {
  return {
    name: "Worker a",
    personalCapYocto: "3000000000000000000000000",
    active: true,
    preferredChain: "near",
    preferredToken: "NEAR",
    paymentSplit: [],
    schedule: "Weekly",
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

  it("keeps a staged upsert inactive across restart until reconciliation commits it", async () => {
    const { directory, plans } = await store();
    await plans.sync({
      contractId: "acme.clavis.testnet",
      recipients: [recipient("a")],
    });
    const operation = await plans.prepareUpsert({
      contractId: "acme.clavis.testnet",
      recipient: recipient("a", { amountYocto: "2000000000000000000000000" }),
      expectedPolicy: expectedPolicy(),
    });

    expect((await plans.get("acme.clavis.testnet"))?.recipients[0]?.amountYocto).toBe(
      "1000000000000000000000000",
    );
    const restarted = new PayrollPlanStore(directory);
    expect((await restarted.listPending()).map((item) => item.operationId)).toEqual([
      operation.operationId,
    ]);

    await restarted.commitPending(operation.operationId);
    expect((await restarted.get("acme.clavis.testnet"))?.recipients[0]?.amountYocto).toBe(
      "2000000000000000000000000",
    );
    expect(await restarted.listPending()).toEqual([]);
  });

  it("does not remove an active recipient until the staged removal is committed", async () => {
    const { plans } = await store();
    await plans.sync({
      contractId: "acme.clavis.testnet",
      recipients: [recipient("a"), recipient("b")],
    });
    const operation = await plans.prepareRemove({
      contractId: "acme.clavis.testnet",
      recipientHash: "a".repeat(64),
    });

    expect((await plans.get("acme.clavis.testnet"))?.recipients).toHaveLength(2);
    await plans.commitPending(operation.operationId);
    expect(
      (await plans.get("acme.clavis.testnet"))?.recipients.map((item) => item.recipientHash),
    ).toEqual(["b".repeat(64)]);
  });

  it("expires abandoned staged operations without changing the active plan", async () => {
    const { directory, plans } = await store();
    await plans.sync({
      contractId: "acme.clavis.testnet",
      recipients: [recipient("a")],
    });
    await plans.prepareRemove({
      contractId: "acme.clavis.testnet",
      recipientHash: "a".repeat(64),
    });
    const pendingPath = path.join(directory, ".pending-payroll-operations.json");
    const pending = JSON.parse(await readFile(pendingPath, "utf8")) as PendingPayrollOperation[];
    await writeFile(
      pendingPath,
      JSON.stringify(
        pending.map((operation) => ({
          ...operation,
          expiresAt: new Date(Date.now() - 1_000).toISOString(),
        })),
      ),
    );

    expect(await new PayrollPlanStore(directory).listPending()).toEqual([]);
    expect((await plans.get("acme.clavis.testnet"))?.recipients).toHaveLength(1);
  });
});
