import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import aiHandler from "../../frontend/api/ai.js";

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  apiKey: process.env.NEAR_AI_API_KEY,
  discoverModels: process.env.NEAR_AI_DISCOVER_MODELS,
  models: process.env.NEAR_AI_MODELS,
  timeout: process.env.NEAR_AI_MODEL_TIMEOUT_MS,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnvironment("NEAR_AI_API_KEY", originalEnvironment.apiKey);
  restoreEnvironment("NEAR_AI_DISCOVER_MODELS", originalEnvironment.discoverModels);
  restoreEnvironment("NEAR_AI_MODELS", originalEnvironment.models);
  restoreEnvironment("NEAR_AI_MODEL_TIMEOUT_MS", originalEnvironment.timeout);
});

test("uses a live catalog model instead of waiting on a retired configured model", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_MODELS = "provider/retired-instruct,provider/current-chat";
  const completionModels: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/models")) {
      return jsonResponse({ data: [{ id: "provider/current-chat" }] });
    }

    const body = JSON.parse(String(init?.body)) as { model: string };
    completionModels.push(body.model);
    return jsonResponse({ choices: [{ message: { content: "All five probes were blocked." } }] });
  };

  const response = await invokeSecuritySummary();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(completionModels, ["provider/current-chat"]);
  assert.equal(response.headers["x-clavis-ai-model"], "provider/current-chat");
});

test("falls through to the next configured model when discovery is disabled", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/failing-instruct,provider/working-instruct";
  const completionModels: string[] = [];

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { model: string };
    completionModels.push(body.model);
    if (body.model === "provider/failing-instruct") {
      return new Response("missing", { status: 404 });
    }
    return jsonResponse({ choices: [{ message: { content: "The verified probes were blocked." } }] });
  };

  const response = await invokeSecuritySummary();
  const repeatedResponse = await invokeSecuritySummary();

  assert.equal(response.statusCode, 200);
  assert.equal(repeatedResponse.statusCode, 200);
  assert.deepEqual(completionModels, [
    "provider/failing-instruct",
    "provider/working-instruct",
    "provider/working-instruct",
  ]);
  assert.equal(response.headers["x-clavis-ai-model"], "provider/working-instruct");
});

async function invokeSecuritySummary(): Promise<TestResponse> {
  const response = new TestResponse();
  await aiHandler(
    {
      method: "POST",
      headers: { origin: "https://clavisapp.vercel.app", host: "clavisapp.vercel.app" },
      body: {
        task: "security-summary",
        input: { contract_id: "payroll.testnet", scenarios: [], results: [] },
      },
    },
    response,
  );
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
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
