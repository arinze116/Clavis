import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import aiHandler from "../../frontend/api/ai.js";

const originalFetch = globalThis.fetch;
let testClientSequence = 0;
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
      if (rpcRequestBody(init).method === "block") return nearFinalBlockResponse(500);
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
      if (rpcRequestBody(init).method === "block") return nearFinalBlockResponse(501);
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

test("tries the next model when policy output is semantically invalid", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/empty-policy,provider/grounded-policy";
  const completionModels: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { model: string };
    completionModels.push(body.model);
    return jsonResponse({
      choices: [
        {
          message: {
            content: body.model === "provider/empty-policy"
              ? "{}"
              : JSON.stringify({
                  daily_limit: 500,
                  per_payment_limit: 100,
                  schedule: "Weekly",
                  recipient_caps: [],
                }),
          },
        },
      ],
    });
  };

  const response = await invokeAiTask({
    task: "policy",
    input: {
      description: "Use a 500 NEAR daily limit and 100 NEAR per payment. Pay weekly.",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(completionModels, ["provider/empty-policy", "provider/grounded-policy"]);
  assert.equal(response.headers["x-clavis-ai-model"], "provider/grounded-policy");
});

test("returns verified security facts when every AI model is unavailable", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/offline-instruct";
  globalThis.fetch = async (input, init) => {
    if (!isNearViewRpc(String(input))) return new Response("unavailable", { status: 503 });
    return rpcRequestBody(init).method === "block"
      ? nearFinalBlockResponse(502)
      : nearViewResponse(securityAuditEntries(), 502);
  };

  const response = await invokeSecuritySummary();

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["x-clavis-ai-model"], "clavis/verified-evidence-engine");
  const payload = response.body as { result: { text: string } };
  assert.match(payload.result.text, /All five fixed probes were blocked/);
  assert.match(payload.result.text, /reproducible evidence, not a guarantee/);
});

test("returns verified security facts without an AI API key", async () => {
  delete process.env.NEAR_AI_API_KEY;
  globalThis.fetch = async (input, init) => {
    assert.equal(isNearViewRpc(String(input)), true);
    return rpcRequestBody(init).method === "block"
      ? nearFinalBlockResponse(503)
      : nearViewResponse(securityAuditEntries(), 503);
  };

  const response = await invokeSecuritySummary();

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["x-clavis-ai-model"], "clavis/verified-evidence-engine");
});

test("does not fabricate policy extraction without an AI API key", async () => {
  delete process.env.NEAR_AI_API_KEY;
  globalThis.fetch = async () => {
    throw new Error("Policy extraction should not call an upstream service without a key");
  };

  const response = await invokeAiTask({
    task: "policy",
    input: { description: "Use a 500 NEAR daily limit and pay weekly." },
  });

  assert.equal(response.statusCode, 503);
  const payload = response.body as { error: string };
  assert.match(payload.error, /not configured/i);
});

test("switches attribution to verified evidence when a model returns invalid output", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/malformed-instruct";
  globalThis.fetch = async (input, init) => {
    if (isNearViewRpc(String(input))) {
      return rpcRequestBody(init).method === "block"
        ? nearFinalBlockResponse(504)
        : nearViewResponse(securityAuditEntries(), 504);
    }
    return jsonResponse({ choices: [{ message: { content: "not structured JSON" } }] });
  };

  const response = await invokeSecuritySummary();

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["x-clavis-ai-model"], "clavis/verified-evidence-engine");
  const payload = response.body as { result: { text: string; next_step_code: string } };
  assert.match(payload.result.text, /All five fixed probes were blocked/);
  assert.equal(payload.result.next_step_code, "expand_property_tests");
});

test("builds payroll facts from live NEAR RPC data and ignores browser-supplied metrics", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/report-instruct";
  const blockHeight = 207;
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  const lastWeekNs = nowNs - 8n * 24n * 60n * 60n * 1_000_000_000n;
  const viewValues: Record<string, unknown> = {
    contract_version: "0.2.0",
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
    get_daily_limit: "1000",
    get_last_reset_timestamp: Number(
      nowNs - 25n * 60n * 60n * 1_000_000_000n,
    ),
    get_log_count: 3,
    get_anomaly_count: 101,
  };
  const rpcMethods: string[] = [];
  const rpcArgsByMethod = new Map<string, Record<string, unknown>>();
  const rpcBlockIds: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = rpcRequestBody(init) as RpcRequestBody & { model?: string };
    if (isNearViewRpc(url)) {
      if (body.method === "block") return nearFinalBlockResponse(blockHeight, nowNs);
      const method = body.params?.method_name ?? "";
      rpcMethods.push(method);
      rpcArgsByMethod.set(method, rpcArgs(body));
      rpcBlockIds.push(body.params?.block_id ?? "");
      return nearViewResponse(viewValues[method], blockHeight);
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
  assert.match(payload.result.text, /Authorized in the current window: Sarah/);
  assert.match(payload.result.text, /Authorization is not proof of off-chain delivery/);
  assert.doesNotMatch(payload.result.text, /Paid in the current window/);
  assert.match(payload.result.text, /Due by the on-chain schedule: Tunde/);
  assert.match(payload.result.text, /Exceeds per-payment limit/);
  assert.match(payload.result.text, /HIGH HIGH_FREQUENCY/);
  assert.match(payload.result.text, /stored authorization counter belongs to an expired 24-hour window/i);
  assert.match(payload.result.text, /Native NEAR payroll settles directly from this account/i);
  assert.match(payload.result.text, /Cross-chain delivery is disabled/i);
  assert.doesNotMatch(payload.result.text, /separately configured settlement funding/i);
  assert.doesNotMatch(payload.result.text, /Estimated runway is/i);
  assert.doesNotMatch(payload.result.text, /999999|Invented person/);
  assert.equal(payload.result.evidence.source, "NEAR testnet RPC");
  assert.equal(payload.result.evidence.block_height_min, blockHeight);
  assert.equal(rpcArgsByMethod.get("get_anomalies")?.from, 1);
  assert.deepEqual(new Set(rpcBlockIds), new Set([`test-block-${blockHeight}`]));
  assert.ok(
    [...rpcMethods].every(
      (method) => method && rpcArgsByMethod.has(method),
    ),
  );
});

test("labels a legacy payroll report as authorization-only", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/report-instruct";
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  const viewValues: Record<string, unknown> = {
    contract_version: "0.1.0",
    get_anomaly_count: 0,
    get_audit_log_reverse: [],
    get_anomalies: [],
    get_recipients: [],
    get_treasury_balance: "3000",
    get_daily_spent: "0",
    get_daily_limit: "1000",
    get_last_reset_timestamp: nowNs.toString(),
    get_log_count: 0,
  };

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (isNearViewRpc(url)) {
      const body = rpcRequestBody(init);
      if (body.method === "block") return nearFinalBlockResponse(208, nowNs);
      const method = body.params?.method_name ?? "";
      return nearViewResponse(viewValues[method], 208);
    }
    return jsonResponse({
      choices: [{ message: { content: '{"recommendation_code":"monitor_operations"}' } }],
    });
  };

  const response = await invokeAiTask({
    task: "payroll-report",
    input: { contract_id: "payroll.testnet" },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.body as { result: { text: string } };
  assert.match(payload.result.text, /reports 0\.1\.0 and is authorization-only/i);
  assert.match(payload.result.text, /does not prove payroll settlement funding/i);
  assert.doesNotMatch(payload.result.text, /Native NEAR payroll settles directly from this account/i);
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

test("fails closed on swapped policy limits and adjacent recipient caps", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/policy-instruct";
  globalThis.fetch = async () =>
    jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              daily_limit: 100,
              per_payment_limit: 500,
              schedule: "Weekly",
              recipient_caps: [
                { name: "Alice", cap: 20 },
                { name: "Bob", cap: 10 },
                { name: "Pay", cap: 500 },
              ],
              warnings: ["Invented warning"],
              ambiguities: ["Invented ambiguity"],
            }),
          },
        },
      ],
    });

  const response = await invokeAiTask({
    task: "policy",
    input: {
      description:
        "Pay up to 500 NEAR per day and no more than 100 NEAR per payment. Alice has a 10 NEAR cap and Bob has a 20 NEAR cap. Pay weekly.",
    },
  });

  assert.equal(response.statusCode, 502);
});

test("does not promote a named recipient cap into the global daily limit", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/policy-instruct";
  globalThis.fetch = async () =>
    jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              daily_limit: 50,
              per_payment_limit: 100,
              schedule: "Weekly",
              recipient_caps: [{ name: "Alice", cap: 50 }],
            }),
          },
        },
      ],
    });

  const response = await invokeAiTask({
    task: "policy",
    input: {
      description:
        "Alice has a 50 NEAR cap for daily payroll. The overall daily limit is 500 NEAR and each payment is limited to 100 NEAR. Pay weekly.",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.body as {
    result: {
      daily_limit: number | null;
      per_payment_limit: number | null;
      recipient_caps: Array<{ name: string; cap: number }>;
      warnings: string[];
    };
  };
  assert.equal(payload.result.daily_limit, null);
  assert.equal(payload.result.per_payment_limit, 100);
  assert.deepEqual(payload.result.recipient_caps, [{ name: "Alice", cap: 50 }]);
  assert.ok(payload.result.warnings.some((warning) => warning.includes("daily limit")));
});

test("preserves recipient context across commas when grounding a daily limit", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/policy-instruct";
  globalThis.fetch = async () =>
    jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              daily_limit: 50,
              per_payment_limit: 100,
              schedule: "Weekly",
              recipient_caps: [],
            }),
          },
        },
      ],
    });

  const response = await invokeAiTask({
    task: "policy",
    input: {
      description:
        "For Alice, allow 50 NEAR per day. The overall daily limit is 500 NEAR and each payment is limited to 100 NEAR. Pay weekly.",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.body as {
    result: { daily_limit: number | null; requires_clarification: boolean; warnings: string[] };
  };
  assert.equal(payload.result.daily_limit, null);
  assert.equal(payload.result.requires_clarification, true);
  assert.ok(payload.result.warnings.some((warning) => warning.includes("daily limit")));
});

test("fails visibly when a model omits an explicit named recipient cap", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/policy-instruct";
  globalThis.fetch = async () =>
    jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              daily_limit: 500,
              per_payment_limit: 100,
              schedule: "Weekly",
              recipient_caps: [],
            }),
          },
        },
      ],
    });

  const response = await invokeAiTask({
    task: "policy",
    input: {
      description:
        "Daily limit: 500 NEAR. Per-payment limit: 100 NEAR. Alice cap: 50 NEAR. Pay weekly.",
    },
  });

  assert.equal(response.statusCode, 502);
});

test("requires clarification when policy text contains multiple schedule types", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/policy-instruct";
  globalThis.fetch = async () =>
    jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              daily_limit: 500,
              per_payment_limit: 100,
              schedule: "Weekly",
              recipient_caps: [],
            }),
          },
        },
      ],
    });

  const response = await invokeAiTask({
    task: "policy",
    input: {
      description:
        "Use a 500 NEAR daily limit and 100 NEAR per payment. Alice is weekly while Bob is milestone based.",
    },
  });

  const payload = response.body as {
    result: { schedule: string | null; requires_clarification: boolean; ambiguities: string[] };
  };
  assert.equal(response.statusCode, 200);
  assert.equal(payload.result.schedule, null);
  assert.equal(payload.result.requires_clarification, true);
  assert.match(payload.result.ambiguities.join(" "), /Multiple schedule types/);
});

test("does not promote a recipient schedule into the payroll default", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/policy-instruct";
  globalThis.fetch = async () =>
    jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              daily_limit: 500,
              per_payment_limit: 100,
              schedule: "Weekly",
              recipient_caps: [],
            }),
          },
        },
      ],
    });

  const response = await invokeAiTask({
    task: "policy",
    input: {
      description:
        "Use a 500 NEAR daily limit and a 100 NEAR per-payment limit. Alice is weekly on Friday.",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.body as {
    result: { schedule: string | null; requires_clarification: boolean; warnings: string[] };
  };
  assert.equal(payload.result.schedule, null);
  assert.equal(payload.result.requires_clarification, true);
  assert.ok(payload.result.warnings.some((warning) => warning.includes("payroll default")));
});

test("does not invent one default weekday or milestone exclusivity", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/policy-instruct";
  let completion = JSON.stringify({
    daily_limit: 500,
    per_payment_limit: 100,
    schedule: "Weekly",
    recipient_caps: [],
  });
  globalThis.fetch = async () =>
    jsonResponse({ choices: [{ message: { content: completion } }] });

  const weekdayResponse = await invokeAiTask({
    task: "policy",
    input: {
      description:
        "Use a 500 NEAR daily limit and a 100 NEAR per-payment limit. Pay weekly on Friday and Monday.",
    },
  });
  completion = JSON.stringify({
    daily_limit: 500,
    per_payment_limit: 100,
    schedule: "Milestone",
    recipient_caps: [],
  });
  const milestoneResponse = await invokeAiTask({
    task: "policy",
    input: {
      description:
        "Use a 500 NEAR daily limit and a 100 NEAR per-payment limit. Use milestone payments.",
    },
  });

  const weekday = weekdayResponse.body as {
    result: { schedule_details: string; requires_clarification: boolean; ambiguities: string[] };
  };
  const milestone = milestoneResponse.body as { result: { schedule_details: string } };
  assert.equal(weekdayResponse.statusCode, 200);
  assert.equal(weekday.result.schedule_details, "Weekly");
  assert.equal(weekday.result.requires_clarification, true);
  assert.match(weekday.result.ambiguities.join(" "), /Multiple weekdays/);
  assert.equal(milestoneResponse.statusCode, 200);
  assert.equal(milestone.result.schedule_details, "Milestone");
});

test("requires explicit NEAR units before applying currency-symbol amounts", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/policy-instruct";
  globalThis.fetch = async () =>
    jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              daily_limit: 500,
              per_payment_limit: 100,
              schedule: "Weekly",
              recipient_caps: [],
            }),
          },
        },
      ],
    });

  const response = await invokeAiTask({
    task: "policy",
    input: {
      description: "Pay up to $500 per day, max $100 per payment. Pay weekly.",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.body as {
    result: { requires_clarification: boolean; ambiguities: string[] };
  };
  assert.equal(payload.result.requires_clarification, true);
  assert.match(payload.result.ambiguities.join(" "), /explicitly in NEAR/);
});

test("requires one unambiguous value for each global limit role", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/policy-instruct";
  globalThis.fetch = async () =>
    jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              daily_limit: 500,
              per_payment_limit: 100,
              schedule: "Weekly",
              recipient_caps: [],
            }),
          },
        },
      ],
    });

  const response = await invokeAiTask({
    task: "policy",
    input: {
      description:
        "Use a 500 NEAR daily limit in January and a 600 NEAR daily limit in February. Use 100 NEAR per payment. Pay weekly.",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.body as {
    result: { daily_limit: number | null; requires_clarification: boolean; ambiguities: string[] };
  };
  assert.equal(payload.result.daily_limit, null);
  assert.equal(payload.result.requires_clarification, true);
  assert.match(payload.result.ambiguities.join(" "), /Multiple global daily limits/);
});

test("fails visibly when a model omits explicitly stated policy values", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/empty-policy-instruct";
  globalThis.fetch = async () =>
    jsonResponse({ choices: [{ message: { content: "{}" } }] });

  const response = await invokeAiTask({
    task: "policy",
    input: {
      description:
        "Use a 500 NEAR daily limit and a 100 NEAR per-payment limit. Pay weekly.",
    },
  });

  assert.equal(response.statusCode, 502);
  const payload = response.body as { error: string };
  assert.match(payload.error, /could not complete/i);
});

test("keeps anomaly severity anchored to the contract evidence", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/anomaly-instruct";
  const anomalyTimestamp = (BigInt(Date.now()) * 1_000_000n).toString();
  let anomalyPrompt: { recent_payments?: Array<{ outcome?: unknown }> } | null = null;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (isNearViewRpc(url)) {
      const body = rpcRequestBody(init);
      if (body.method === "block") return nearFinalBlockResponse(600);
      if (body.params?.method_name === "get_anomalies") {
        return nearViewResponse(
          [
            {
              anomaly_id: 7,
              timestamp: anomalyTimestamp,
              anomaly_type: "HIGH_FREQUENCY",
              severity: "HIGH",
              description: "12 payment requests in the last hour",
              reviewed: false,
            },
          ],
          600,
        );
      }
      return nearViewResponse(
        [
          {
            payment_id: 2,
            timestamp: anomalyTimestamp,
            outcome: { Rejected: "Security audit: Recipient not approved" },
            block_height: 599,
          },
          {
            payment_id: 1,
            timestamp: anomalyTimestamp,
            outcome: "Approved",
            block_height: 598,
          },
        ],
        600,
      );
    }
    const requestBody = JSON.parse(String(init?.body)) as {
      messages?: Array<{ role?: string; content?: string }>;
    };
    const userContent = requestBody.messages?.find((message) => message.role === "user")?.content;
    anomalyPrompt = userContent ? JSON.parse(userContent) as typeof anomalyPrompt : null;
    return jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              likely_cause: "configuration_issue",
              action_codes: ["inspect_scheduler_logs", "review_policy_configuration"],
              meaning: "Invented anomaly meaning",
              cause_reasoning: "Invented cause evidence",
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
  const payload = response.body as {
    result: { severity: string; meaning: string; cause_reasoning: string; evidence: { block_height: number } };
  };
  assert.equal(payload.result.severity, "High");
  assert.match(payload.result.meaning, /contract recorded a high-severity high frequency anomaly/i);
  assert.doesNotMatch(payload.result.meaning, /Invented anomaly meaning/);
  assert.doesNotMatch(payload.result.cause_reasoning, /Invented cause evidence/);
  assert.equal(payload.result.evidence.block_height, 600);
  assert.equal(anomalyPrompt?.recent_payments?.length, 1);
  assert.equal(anomalyPrompt?.recent_payments?.[0]?.outcome, "Approved");
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
              route_code: "near",
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
  assert.match(payload.result.reason, /only route supported by Clavis source v0\.3/i);
  assert.match(payload.result.reason, /does not prove the deployed contract version, agent uptime, or completed delivery/i);
  assert.match(payload.result.gas_comparison, /NEAR testnet: .*gas-unit price 100000000/);
  assert.doesNotMatch(payload.result.gas_comparison, /Invented gas claim/);
  assert.doesNotMatch(payload.result.reason, /Invented route claim/);
  assert.ok(Number.isFinite(Date.parse(payload.result.observed_at)));
});

test("switches route and anomaly attribution when a model makes no selection", async () => {
  process.env.NEAR_AI_API_KEY = "test-key";
  process.env.NEAR_AI_DISCOVER_MODELS = "false";
  process.env.NEAR_AI_MODELS = "provider/empty-evidence-instruct";
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("cloud-api.near.ai")) {
      return jsonResponse({ choices: [{ message: { content: "{}" } }] });
    }
    const body = rpcRequestBody(init);
    if (body.method === "block") return nearFinalBlockResponse(650, nowNs);
    if (body.method === "query") {
      return body.params?.method_name === "get_anomalies"
        ? nearViewResponse(
            [
              {
                anomaly_id: 8,
                timestamp: nowNs.toString(),
                anomaly_type: "HIGH_FREQUENCY",
                severity: "HIGH",
                description: "12 payment requests in the last hour",
                reviewed: false,
              },
            ],
            650,
          )
        : nearViewResponse([], 650);
    }
    return body.method === "gas_price"
      ? jsonResponse({ result: { gas_price: "100000000" } })
      : jsonResponse({ result: "0x3b9aca00" });
  };

  const anomalyResponse = await invokeAiTask({
    task: "anomaly",
    input: { contract_id: "payroll.testnet", anomaly_id: 8 },
  });
  const routeResponse = await invokeAiTask({
    task: "route",
    input: { selected_chain: "ethereum", selected_token: "USDC", region: "Nigeria" },
  });

  assert.equal(anomalyResponse.statusCode, 200);
  assert.equal(routeResponse.statusCode, 200);
  assert.equal(anomalyResponse.headers["x-clavis-ai-model"], "clavis/verified-evidence-engine");
  assert.equal(routeResponse.headers["x-clavis-ai-model"], "clavis/verified-evidence-engine");
});

test("keeps anomaly and route guidance available without an AI key", async () => {
  delete process.env.NEAR_AI_API_KEY;
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal(url.includes("cloud-api.near.ai"), false);
    const body = rpcRequestBody(init);
    if (body.method === "block") return nearFinalBlockResponse(700, nowNs);
    if (body.method === "query") {
      return body.params?.method_name === "get_anomalies"
        ? nearViewResponse(
            [
              {
                anomaly_id: 9,
                timestamp: nowNs.toString(),
                anomaly_type: "HIGH_FREQUENCY",
                severity: "HIGH",
                description: "12 payment requests in the last hour",
                reviewed: false,
              },
            ],
            700,
          )
        : nearViewResponse([], 700);
    }
    return body.method === "gas_price"
      ? jsonResponse({ result: { gas_price: "100000000" } })
      : jsonResponse({ result: "0x3b9aca00" });
  };

  const anomalyResponse = await invokeAiTask({
    task: "anomaly",
    input: { contract_id: "payroll.testnet", anomaly_id: 9 },
  });
  const routeResponse = await invokeAiTask({
    task: "route",
    input: { selected_chain: "ethereum", selected_token: "USDC", region: "Nigeria" },
  });

  assert.equal(anomalyResponse.statusCode, 200);
  assert.equal(routeResponse.statusCode, 200);
  assert.equal(anomalyResponse.headers["x-clavis-ai-model"], "clavis/verified-evidence-engine");
  assert.equal(routeResponse.headers["x-clavis-ai-model"], "clavis/verified-evidence-engine");
  const anomaly = anomalyResponse.body as { result: { meaning: string; actions: string[] } };
  const route = routeResponse.body as { result: { chain: string; reason: string } };
  assert.match(anomaly.result.meaning, /contract recorded/i);
  assert.equal(anomaly.result.actions.length, 2);
  assert.equal(route.result.chain, "near");
  assert.match(route.result.reason, /does not prove the deployed contract version/i);
  assert.match(route.result.reason, /agent uptime/i);
  assert.match(route.result.reason, /completed delivery/i);
});

async function invokeSecuritySummary(): Promise<TestResponse> {
  return invokeAiTask({
    task: "security-summary",
    input: { contract_id: "payroll.testnet", results: verifiedSecurityResults() },
  });
}

async function invokeAiTask(body: unknown): Promise<TestResponse> {
  const response = new TestResponse();
  testClientSequence += 1;
  await aiHandler(
    {
      method: "POST",
      headers: {
        origin: "https://clavisapp.vercel.app",
        host: "clavisapp.vercel.app",
        "x-forwarded-for": `test-client-${testClientSequence}`,
      },
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

function nearViewResponse(
  value: unknown,
  blockHeight: number,
  blockHash = `test-block-${blockHeight}`,
): Response {
  return jsonResponse({
    result: {
      result: [...Buffer.from(JSON.stringify(value), "utf8")],
      block_height: blockHeight,
      block_hash: blockHash,
    },
  });
}

function nearFinalBlockResponse(
  blockHeight: number,
  timestampNanoseconds = BigInt(Date.now()) * 1_000_000n,
  blockHash = `test-block-${blockHeight}`,
): Response {
  return jsonResponse({
    result: {
      header: {
        height: blockHeight,
        hash: blockHash,
        timestamp_nanosec: timestampNanoseconds.toString(),
      },
    },
  });
}

interface RpcRequestBody {
  method?: string;
  params?: {
    method_name?: string;
    block_id?: string;
    args_base64?: string;
  };
}

function rpcRequestBody(init?: RequestInit): RpcRequestBody {
  return JSON.parse(String(init?.body)) as RpcRequestBody;
}

function rpcArgs(body: RpcRequestBody): Record<string, unknown> {
  const encoded = body.params?.args_base64;
  return encoded
    ? JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Record<string, unknown>
    : {};
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
  return (
    url.includes("test.rpc.fastnear.com") ||
    url.includes("near-testnet.drpc.org") ||
    url.includes("rpc.testnet.fastnear.com") ||
    url.includes("rpc.testnet.near.org")
  );
}
