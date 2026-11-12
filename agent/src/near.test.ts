import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertContractControlledSettlementVersion,
  assertRestrictedAgentAccessKey,
  NearRpcClient,
} from "./near.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("NearRpcClient", () => {
  it("fails over after a rate-limited Testnet RPC response", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        requestedUrls.push(String(input));
        if (requestedUrls.length === 1) {
          return new Response(JSON.stringify({ error: "rate limited" }), { status: 429 });
        }
        return Response.json({ jsonrpc: "2.0", id: "clavis-agent", result: "ok" });
      }),
    );

    const client = new NearRpcClient("https://test.rpc.fastnear.com");

    await expect(client.jsonRpc("status", [])).resolves.toBe("ok");
    expect(requestedUrls).toEqual([
      "https://test.rpc.fastnear.com",
      "https://testnet-rpc.intea.rs",
    ]);
  });

  it("does not retry a non-transient contract RPC error", async () => {
    const request = vi.fn(async () =>
      Response.json({
        jsonrpc: "2.0",
        id: "clavis-agent",
        error: { message: "MethodNotFound" },
      }),
    );
    vi.stubGlobal("fetch", request);

    const client = new NearRpcClient("https://near-testnet.drpc.org");

    await expect(client.jsonRpc("query", {})).rejects.toThrow("MethodNotFound");
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("assertContractControlledSettlementVersion", () => {
  it.each(["0.3.0", "0.4.0", "1.0.0"])("accepts scheduler-compatible version %s", (version) => {
    expect(() => assertContractControlledSettlementVersion(version)).not.toThrow();
  });

  it.each(["0.2.0", "0.1.0", "0.0.9"])("rejects scheduler-incompatible version %s", (version) => {
    expect(() => assertContractControlledSettlementVersion(version)).toThrow(
      "v0.3.0 or newer is required",
    );
  });

  it.each(["", "v0.2.0", "v0.3.0", "0.3", "0.3.0-beta"])(
    "rejects incompatible or invalid version %j",
    (version) => {
      expect(() => assertContractControlledSettlementVersion(version)).toThrow(
        "returned an invalid version",
      );
    },
  );
});

describe("assertRestrictedAgentAccessKey", () => {
  it("accepts only request_payment on the intended contract", () => {
    expect(() =>
      assertRestrictedAgentAccessKey(
        {
          permission: {
            FunctionCall: {
              allowance: null,
              receiver_id: "acme.clavis.testnet",
              method_names: ["request_payment"],
            },
          },
        },
        "acme.clavis.testnet",
      ),
    ).not.toThrow();
  });

  it("rejects Full Access keys without an override", () => {
    expect(() =>
      assertRestrictedAgentAccessKey(
        { permission: "FullAccess" },
        "acme.clavis.testnet",
      ),
    ).toThrow("Refusing to start with a Full Access agent key");
  });

  it.each([
    {
      receiver_id: "globex.clavis.testnet",
      method_names: ["request_payment"],
    },
    {
      receiver_id: "acme.clavis.testnet",
      method_names: [],
    },
    {
      receiver_id: "acme.clavis.testnet",
      method_names: ["request_payment", "set_agent"],
    },
  ])("rejects over-broad Function Call permission %#", (permission) => {
    expect(() =>
      assertRestrictedAgentAccessKey(
        {
          permission: {
            FunctionCall: {
              allowance: null,
              ...permission,
            },
          },
        },
        "acme.clavis.testnet",
      ),
    ).toThrow("Agent key must only call request_payment on acme.clavis.testnet");
  });
});
