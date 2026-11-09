import { describe, expect, it } from "vitest";

import { buildIntentEnvelopes, IntentClient } from "./intents.js";

describe("buildIntentEnvelopes", () => {
  it("allocates an exact total and gives rounding remainder to the final route", () => {
    const envelopes = buildIntentEnvelopes("acme.clavis.testnet", 47, {
      recipientHash: "a".repeat(64),
      name: "Worker",
      nearAddress: "worker.testnet",
      amountYocto: "101",
      milestoneReady: false,
      destinations: [
        { chain: "near", token: "NEAR", address: "worker.testnet", percentage: 70 },
        {
          chain: "ethereum",
          token: "USDC",
          address: "0x1111111111111111111111111111111111111111",
          percentage: 30,
        },
      ],
    });

    expect(envelopes.map((intent) => intent.sourceAmountYocto)).toEqual(["70", "31"]);
    expect(envelopes.reduce((sum, intent) => sum + BigInt(intent.sourceAmountYocto), 0n)).toBe(101n);
    expect(envelopes.map((intent) => intent.intentId)).toEqual([
      "acme.clavis.testnet:47:1",
      "acme.clavis.testnet:47:2",
    ]);
  });
});

describe("IntentClient settlement semantics", () => {
  it("accepts a single native route whose destination matches the worker account", async () => {
    const client = new IntentClient({
      solverRelayUrl: "https://solver-relay-v2.chaindefuser.com/rpc",
      apiKey: undefined,
    });
    const envelope = {
      intentId: "clavis.testnet:1:1",
      contractId: "clavis.testnet",
      paymentId: 1,
      recipientHash: "a".repeat(64),
      recipientName: "Worker",
      nearRecipient: "worker.testnet",
      sourceAsset: "NEAR",
      sourceAmountYocto: "10",
      destination: {
        chain: "near",
        token: "NEAR",
        address: "worker.testnet",
        percentage: 100,
      },
      createdAt: new Date(0).toISOString(),
    } as const;

    await expect(client.preflight([envelope])).resolves.toBeUndefined();
  });

  it("rejects a native payout address that differs from the worker account", async () => {
    const client = new IntentClient({
      solverRelayUrl: "https://solver-relay-v2.chaindefuser.com/rpc",
      apiKey: undefined,
    });

    await expect(
      client.preflight([{
        intentId: "clavis.testnet:1:1",
        contractId: "clavis.testnet",
        paymentId: 1,
        recipientHash: "a".repeat(64),
        recipientName: "Worker",
        nearRecipient: "worker.testnet",
        sourceAsset: "NEAR",
        sourceAmountYocto: "1",
        destination: {
          chain: "near",
          token: "NEAR",
          address: "attacker.testnet",
          percentage: 100,
        },
        createdAt: new Date(0).toISOString(),
      }]),
    ).rejects.toThrow("must match the approved recipient account");
  });

  it("fails preflight before authorization for every cross-chain route", async () => {
    const client = new IntentClient({
      solverRelayUrl: "https://solver-relay-v2.chaindefuser.com/rpc",
      apiKey: undefined,
    });
    const [envelope] = buildIntentEnvelopes("clavis.testnet", 0, {
      recipientHash: "a".repeat(64),
      name: "Worker",
      nearAddress: "identity-wallet.testnet",
      amountYocto: "10",
      milestoneReady: false,
      destinations: [
        {
          chain: "ethereum",
          token: "USDC",
          address: "0x1111111111111111111111111111111111111111",
          percentage: 100,
        },
      ],
    });

    await expect(client.preflight([envelope!])).rejects.toThrow(
      "Cross-chain settlement is disabled",
    );
  });

  it("never submits funds from an external settlement signer", async () => {
    const client = new IntentClient({
      solverRelayUrl: "https://solver-relay-v2.chaindefuser.com/rpc",
      apiKey: undefined,
    });
    const [envelope] = buildIntentEnvelopes("clavis.testnet", 1, {
      recipientHash: "a".repeat(64),
      name: "Worker",
      nearAddress: "worker.testnet",
      amountYocto: "10",
      milestoneReady: false,
      destinations: [
        { chain: "near", token: "NEAR", address: "worker.testnet", percentage: 100 },
      ],
    });

    await expect(client.submit(envelope!)).rejects.toThrow(
      "native NEAR is transferred by the payroll contract",
    );
  });
});
