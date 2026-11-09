import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import nearRpcHandler from "../../api/near-rpc.js";

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  clavisRpc: process.env.CLAVIS_NEAR_TESTNET_RPC_URL,
  nearRpc: process.env.NEAR_RPC_URL,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnvironment("CLAVIS_NEAR_TESTNET_RPC_URL", originalEnvironment.clavisRpc);
  restoreEnvironment("NEAR_RPC_URL", originalEnvironment.nearRpc);
});

test("rejects unsupported NEAR RPC methods", async () => {
  const response = await invoke({
    jsonrpc: "2.0",
    id: "write-attempt",
    method: "broadcast_tx_commit",
    params: ["signed-transaction"],
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: "Invalid or unsupported NEAR RPC request" });
});

test("forwards an allowed read through the same-origin RPC boundary", async () => {
  delete process.env.CLAVIS_NEAR_TESTNET_RPC_URL;
  delete process.env.NEAR_RPC_URL;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input, init) => {
    requestedUrls.push(String(input));
    assert.equal(JSON.parse(String(init?.body)).method, "query");
    return jsonResponse({ jsonrpc: "2.0", id: "view", result: { block_height: 42 } });
  };

  const response = await invoke(viewRequest());

  assert.equal(response.statusCode, 200);
  assert.deepEqual(requestedUrls, ["https://rpc.testnet.near.org/"]);
  assert.equal(
    (JSON.parse(String(response.body)) as { result: { block_height: number } }).result.block_height,
    42,
  );
});

test("fails over when the configured RPC is rate limited", async () => {
  process.env.NEAR_RPC_URL = "https://primary-rpc.example";
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    if (requestedUrls.length === 1) return jsonResponse({ error: "rate limited" }, 429);
    return jsonResponse({ jsonrpc: "2.0", id: "view", result: { block_height: 43 } });
  };

  const response = await invoke(viewRequest());

  assert.equal(response.statusCode, 200);
  assert.deepEqual(requestedUrls, [
    "https://primary-rpc.example/",
    "https://rpc.testnet.near.org/",
  ]);
});

function viewRequest() {
  return {
    jsonrpc: "2.0",
    id: "view",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: "clavis.testnet",
      method_name: "get_owner",
      args_base64: "e30=",
    },
  };
}

async function invoke(body: unknown): Promise<TestResponse> {
  const response = new TestResponse();
  await nearRpcHandler({ method: "POST", body }, response);
  return response;
}

class TestResponse {
  readonly headers: Record<string, string> = {};
  statusCode = 200;
  body: unknown;

  setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }

  status(code: number): TestResponse {
    this.statusCode = code;
    return this;
  }

  json(value: unknown): void {
    this.body = value;
  }

  send(value: string): void {
    this.body = value;
  }
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
