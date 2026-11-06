import { describe, expect, it, vi } from "vitest";

import { buildIntentEnvelopes, buildTokenDiffIntent, IntentClient } from "./intents.js";
import type { NearTransferClient } from "./near.js";

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

describe("buildTokenDiffIntent", () => {
  it("builds the live testnet token diff with a two-minute deadline", () => {
    expect(
      buildTokenDiffIntent(
        "1000",
        "nep141:usdc.fakes.testnet",
        "25",
        1_000,
      ),
    ).toEqual({
      intent_type: "token_diff",
      diff: {
        "nep141:wrap.testnet": "-1000",
        "nep141:usdc.fakes.testnet": "+25",
      },
      deadline: { timestamp: 1_120 },
    });
  });

  it("refuses an invalid same-asset token diff", () => {
    expect(() =>
      buildTokenDiffIntent("1000", "nep141:wrap.testnet", "1000"),
    ).toThrow("requires different input and output assets");
  });
});

describe("IntentClient settlement semantics", () => {
  it("uses the configured native payout destination instead of the worker identity wallet", async () => {
    const transferNear = vi.fn(async () => "native-near-transaction");
    const client = new IntentClient({
      solverRelayUrl: "https://solver-relay-v2.chaindefuser.com/rpc",
      apiKey: undefined,
      intentsContractId: "intents.near",
      signerAccountId: undefined,
      signerPrivateKey: undefined,
      transferClient: { transferNear } as unknown as NearTransferClient,
    });

    const result = await client.submit({
      intentId: "clavis.testnet:1:1",
      contractId: "clavis.testnet",
      paymentId: 1,
      recipientHash: "a".repeat(64),
      recipientName: "Worker",
      nearRecipient: "identity-wallet.testnet",
      sourceAsset: "NEAR",
      sourceAmountYocto: "10",
      destination: {
        chain: "near",
        token: "NEAR",
        address: "payout-wallet.testnet",
        percentage: 100,
      },
      createdAt: new Date(0).toISOString(),
    });

    expect(transferNear).toHaveBeenCalledWith("payout-wallet.testnet", "10");
    expect(result).toMatchObject({ settlementKind: "native_near", fallback: false });
  });

  it("refuses to present a direct NEAR substitute as a BNB cross-chain settlement", async () => {
    const client = new IntentClient({
      solverRelayUrl: "https://solver-relay-v2.chaindefuser.com/rpc",
      apiKey: undefined,
      intentsContractId: "intents.near",
      signerAccountId: undefined,
      signerPrivateKey: undefined,
      transferClient: undefined,
    });

    await expect(
      client.submit({
        intentId: "clavis.testnet:1:1",
        contractId: "clavis.testnet",
        paymentId: 1,
        recipientHash: "a".repeat(64),
        recipientName: "Worker",
        nearRecipient: "worker.testnet",
        sourceAsset: "NEAR",
        sourceAmountYocto: "1",
        destination: {
          chain: "bnb",
          token: "BUSD",
          address: "0x1111111111111111111111111111111111111111",
          percentage: 100,
        },
        createdAt: new Date(0).toISOString(),
      }),
    ).rejects.toThrow("refusing to relabel direct NEAR as cross-chain settlement");
  });

  it("fails preflight before authorization when a cross-chain signer is unavailable", async () => {
    const client = new IntentClient({
      solverRelayUrl: "https://solver-relay-v2.chaindefuser.com/rpc",
      apiKey: undefined,
      intentsContractId: "intents.near",
      signerAccountId: undefined,
      signerPrivateKey: undefined,
      transferClient: undefined,
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
      "Cross-chain settlement signer is not configured",
    );
  });
});
