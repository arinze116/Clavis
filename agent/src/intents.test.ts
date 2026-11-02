import { describe, expect, it } from "vitest";

import { buildIntentEnvelopes } from "./intents.js";

describe("buildIntentEnvelopes", () => {
  it("allocates an exact total and gives rounding remainder to the final route", () => {
    const envelopes = buildIntentEnvelopes(47, {
      recipientHash: "a".repeat(64),
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
    expect(envelopes.map((intent) => intent.intentId)).toEqual(["47:1", "47:2"]);
  });
});
