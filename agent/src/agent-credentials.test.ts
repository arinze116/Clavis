import { describe, expect, it } from "vitest";

import {
  AgentCredentialProvider,
  assertNoFullAccessOverride,
} from "./agent-credentials.js";

describe("AgentCredentialProvider", () => {
  it("selects an isolated restricted credential for each contract", () => {
    const provider = AgentCredentialProvider.fromEntries([
      {
        contractId: "acme.clavis.testnet",
        accountId: "clavis-agent.testnet",
        privateKey: "ed25519:acme-key",
      },
      {
        contractId: "globex.clavis.testnet",
        accountId: "clavis-agent.testnet",
        privateKey: "ed25519:globex-key",
      },
    ]);

    expect(provider.resolve("acme.clavis.testnet")).toEqual({
      accountId: "clavis-agent.testnet",
      privateKey: "ed25519:acme-key",
    });
    expect(provider.resolve("globex.clavis.testnet")).toEqual({
      accountId: "clavis-agent.testnet",
      privateKey: "ed25519:globex-key",
    });
  });

  it("fails closed when a credential file omits a discovered contract", () => {
    const provider = AgentCredentialProvider.fromEntries([
      {
        contractId: "acme.clavis.testnet",
        accountId: "clavis-agent.testnet",
        privateKey: "ed25519:acme-key",
      },
    ]);

    expect(() => provider.resolve("globex.clavis.testnet")).toThrow(
      "No restricted agent credential is configured for globex.clavis.testnet",
    );
  });

  it("rejects duplicate contract entries", () => {
    expect(() =>
      AgentCredentialProvider.fromEntries([
        {
          contractId: "acme.clavis.testnet",
          accountId: "agent-one.testnet",
          privateKey: "ed25519:first-key",
        },
        {
          contractId: "acme.clavis.testnet",
          accountId: "agent-two.testnet",
          privateKey: "ed25519:second-key",
        },
      ]),
    ).toThrow("Duplicate agent credential for acme.clavis.testnet");
  });

  it("preserves a single-contract environment credential when no file is configured", async () => {
    const provider = await AgentCredentialProvider.load({
      legacyCredential: {
        accountId: "clavis-agent.testnet",
        privateKey: "ed25519:legacy-key",
      },
      legacyContractId: "clavis.testnet",
    });

    expect(provider.resolve("clavis.testnet")).toEqual({
      accountId: "clavis-agent.testnet",
      privateKey: "ed25519:legacy-key",
    });
    expect(() => provider.resolve("other.clavis.testnet")).toThrow(
      "legacy agent credential is bound to clavis.testnet",
    );
  });
});

describe("full-access override", () => {
  it("rejects the removed Full Access configuration escape hatch", () => {
    expect(() => assertNoFullAccessOverride("true")).toThrow(
      "ALLOW_FULL_ACCESS_AGENT is no longer supported",
    );
    expect(() => assertNoFullAccessOverride("false")).toThrow(
      "ALLOW_FULL_ACCESS_AGENT is no longer supported",
    );
  });

  it("accepts an absent override", () => {
    expect(() => assertNoFullAccessOverride(undefined)).not.toThrow();
  });
});
