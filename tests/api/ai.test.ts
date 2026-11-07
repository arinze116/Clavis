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
    if (isNearViewRpc(url)) {
      return nearViewResponse(securityAuditEntries(), 500);
    }

    const body = JSON.parse(String(init?.body)) as { model: string };
    completionModels.push(body.model);
    return jsonResponse({
      choices: [{ message: { content: '{"next_step_code":"expand_property_tests"}' } }],
    });
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

  globalThis.fetch = async (input, init) => {
    if (isNearViewRpc(String(input))) {
      return nearViewResponse(securityAuditEntries(), 501);
    }
    const body = JSON.parse(String(init?.body)) as { model: string };
    completionModels.push(body.model);
    if (body.model === "provider/failing-instruct") {
      return new Response("missing", { status: 404 });
    }
    return jsonResponse({
      choices: [{ message: { content: '{"next_step_code":"review_key_governance"}' } }],
    });
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

test("returns verified security facts when every AI model is unavailable", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/offline-instruct";
  globalThis.fetch = async (input) =>
    isNearViewRpc(String(input))
      ? nearViewResponse(securityAuditEntries(), 502)
      : new Response("unavailable", { status: 503 });

  const response = await invokeSecuritySummary();

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["x-clavis-ai-model"], "clavis/verified-evidence-engine");
  const payload = response.body as { result: { text: string } };
  assert.match(payload.result.text, /All five fixed probes were blocked/);
  assert.match(payload.result.text, /reproducible evidence, not a guarantee/);
});

test("returns verified security facts without an AI API key", async () => {
  delete process.env.NEAR_AI_API_KEY;
  globalThis.fetch = async (input) => {
    assert.equal(isNearViewRpc(String(input)), true);
    return nearViewResponse(securityAuditEntries(), 503);
  };

  const response = await invokeSecuritySummary();

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["x-clavis-ai-model"], "clavis/verified-evidence-engine");
});

test("builds payroll facts from live NEAR RPC data and ignores browser-supplied metrics", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/report-instruct";
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  const lastWeekNs = nowNs - 8n * 24n * 60n * 60n * 1_000_000_000n;
  const viewValues: Record<string, unknown> = {
    get_audit_log_reverse: [
      { payment_id: 3, timestamp: nowNs.toString(), outcome: "Approved", block_height: 101 },
      {
        payment_id: 2,
        timestamp: nowNs.toString(),
        outcome: { Rejected: "Exceeds per-payment limit" },
        block_height: 100,
      },
      { payment_id: 1, timestamp: lastWeekNs.toString(), outcome: "Approved", block_height: 99 },
    ],
    get_anomalies: [
      {
        anomaly_id: 1,
        timestamp: nowNs.toString(),
        anomaly_type: "HIGH_FREQUENCY",
        severity: "HIGH",
        description: "12 payment requests in the last hour",
        reviewed: false,
      },
    ],
    get_recipients: [
      {
        name: "Sarah",
        active: true,
        schedule: "Weekly",
        last_paid: nowNs.toString(),
        next_payment_at: (nowNs + 86_400_000_000_000n).toString(),
      },
      {
        name: "Tunde",
        active: true,
        schedule: "Weekly",
        last_paid: "0",
        next_payment_at: nowNs.toString(),
      },
    ],
    get_treasury_balance: "3000",
    get_daily_spent: "100",
    get_log_count: 3,
  };
  const rpcMethods: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body)) as {
      model?: string;
      params?: { method_name?: string };
    };
    if (isNearViewRpc(url)) {
      const method = body.params?.method_name ?? "";
      rpcMethods.push(method);
      return nearViewResponse(viewValues[method], 200 + rpcMethods.length);
    }
    return jsonResponse({
      choices: [{ message: { content: '{"recommendation_code":"review_anomalies"}' } }],
    });
  };

  const response = new TestResponse();
  await aiHandler(
    {
      method: "POST",
      headers: { origin: "https://clavisapp.vercel.app", host: "clavisapp.vercel.app" },
      body: {
        task: "payroll-report",
        input: {
          contract_id: "payroll.testnet",
          payment_comparison: { this_week: 999_999 },
          recipients: { paid_this_week: ["Invented person"] },
        },
      },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(new Set(rpcMethods), new Set(Object.keys(viewValues)));
  const payload = response.body as {
    result: { text: string; evidence: { source: string; block_height_min: number } };
  };
  assert.match(payload.result.text, /complete contract audit window shows 1 approved authorization decision.*versus 1 previously/);
  assert.match(payload.result.text, /Paid in the current window: Sarah/);
  assert.match(payload.result.text, /Due by the on-chain schedule: Tunde/);
  assert.match(payload.result.text, /Exceeds per-payment limit/);
  assert.match(payload.result.text, /HIGH HIGH_FREQUENCY/);
  assert.doesNotMatch(payload.result.text, /999999|Invented person/);
  assert.equal(payload.result.evidence.source, "NEAR testnet RPC");
  assert.equal(payload.result.evidence.block_height_min, 201);
});

test("removes policy values that the model invents", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/policy-instruct";
  globalThis.fetch = async () =>
    jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              daily_limit: 999,
              per_payment_limit: 10,
              schedule: "Weekly",
              schedule_details: "Weekly on Fridays",
              recipient_caps: [],
              summary: ["Invented summary"],
              warnings: [],
              ambiguities: [],
              requires_clarification: false,
              too_vague: false,
              clarification_message: null,
            }),
          },
        },
      ],
    });

  const response = await invokeAiTask({
    task: "policy",
    input: { description: "Pay weekly on Fridays with a 10 NEAR per-payment limit." },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.body as {
    result: { daily_limit: number | null; per_payment_limit: number; summary: string[]; warnings: string[] };
  };
  assert.equal(payload.result.daily_limit, null);
  assert.equal(payload.result.per_payment_limit, 10);
  assert.deepEqual(payload.result.summary, ["Per-payment limit: 10 NEAR.", "Default schedule: Weekly."]);
  assert.ok(payload.result.warnings.some((warning) => warning.includes("not present")));
});

test("keeps anomaly severity anchored to the contract evidence", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/anomaly-instruct";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (isNearViewRpc(url)) {
      const body = JSON.parse(String(init?.body)) as { params?: { method_name?: string } };
      return body.params?.method_name === "get_anomalies"
        ? nearViewResponse(
            [
              {
                anomaly_id: 7,
                timestamp: (BigInt(Date.now()) * 1_000_000n).toString(),
                anomaly_type: "HIGH_FREQUENCY",
                severity: "HIGH",
                description: "12 payment requests in the last hour",
                reviewed: false,
              },
            ],
            600,
          )
        : nearViewResponse([], 601);
    }
    return jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              meaning: "A burst of requests was recorded.",
              likely_cause: "configuration_issue",
              cause_reasoning: "The supplied evidence is consistent with a retry loop.",
              actions: ["Inspect the scheduler logs.", "Pause the agent if requests continue."],
              severity: "Low",
              severity_reasoning: "Model opinion should not override contract evidence.",
            }),
          },
        },
      ],
    });
  };

  const response = await invokeAiTask({
    task: "anomaly",
    input: {
      contract_id: "payroll.testnet",
      anomaly_id: 7,
      contract_severity: "MEDIUM",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.body as { result: { severity: string } };
  assert.equal(payload.result.severity, "High");
});

test("returns route measurements from live RPC evidence instead of model prose", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/route-instruct";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body)) as { method?: string };
    if (!url.includes("cloud-api.near.ai")) {
      return body.method === "gas_price"
        ? jsonResponse({ result: { gas_price: "100000000" } })
        : jsonResponse({ result: "0x3b9aca00" });
    }
    return jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              chain: "near",
              token: "NEAR",
              reason: "Invented route claim",
              region_rationale: "Nigeria is used only as a soft accessibility signal.",
              gas_comparison: "Invented gas claim",
              confidence: "high",
            }),
          },
        },
      ],
    });
  };

  const response = await invokeAiTask({
    task: "route",
    input: { selected_chain: "ethereum", selected_token: "USDC", region: "Nigeria" },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.body as {
    result: { chain: string; reason: string; gas_comparison: string; observed_at: string };
  };
  assert.equal(payload.result.chain, "near");
  assert.match(payload.result.reason, /marked executable/);
  assert.match(payload.result.gas_comparison, /NEAR testnet: .*gas-unit price 100000000/);
  assert.doesNotMatch(payload.result.gas_comparison, /Invented gas claim/);
  assert.ok(Number.isFinite(Date.parse(payload.result.observed_at)));
});

async function invokeSecuritySummary(): Promise<TestResponse> {
  return invokeAiTask({
    task: "security-summary",
    input: { contract_id: "payroll.testnet", results: verifiedSecurityResults() },
  });
}

async function invokeAiTask(body: unknown): Promise<TestResponse> {
  const response = new TestResponse();
  await aiHandler(
    {
      method: "POST",
      headers: { origin: "https://clavisapp.vercel.app", host: "clavisapp.vercel.app" },
      body,
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

function nearViewResponse(value: unknown, blockHeight: number): Response {
  return jsonResponse({
    result: {
      result: [...Buffer.from(JSON.stringify(value), "utf8")],
      block_height: blockHeight,
      block_hash: "test-block-hash",
    },
  });
}

function verifiedSecurityResults() {
  return [
    {
      scenario: "UNAPPROVED_RECIPIENT",
      blocked: true,
      reason: "Security audit: Recipient not approved",
      payment_id: 1,
    },
    {
      scenario: "OVER_LIMIT_PAYMENT",
      blocked: true,
      reason: "Security audit: Exceeds per-payment limit",
      payment_id: 2,
    },
    {
      scenario: "SUSPENDED_RECIPIENT",
      blocked: true,
      reason: "Security audit: Recipient suspended",
      payment_id: 3,
    },
    {
      scenario: "DAILY_LIMIT_BREACH",
      blocked: true,
      reason: "Security audit: Daily limit exceeded",
      payment_id: 4,
    },
    {
      scenario: "OFF_HOURS_PAYMENT",
      blocked: true,
      reason: "Security audit: Off-hours payment blocked",
      payment_id: 5,
    },
  ];
}

function securityAuditEntries() {
  return verifiedSecurityResults().map((result) => ({
    payment_id: result.payment_id,
    timestamp: "1",
    outcome: { Rejected: result.reason },
    block_height: 499,
  }));
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function isNearViewRpc(url: string): boolean {
  return url.includes("rpc.testnet.fastnear.com") || url.includes("rpc.testnet.near.org");
}
