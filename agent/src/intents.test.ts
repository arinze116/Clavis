import { describe, expect, it } from "vitest";

import { buildIntentEnvelopes, buildTokenDiffIntent } from "./intents.js";

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
