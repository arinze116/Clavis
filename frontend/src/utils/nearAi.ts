import type { Chain, Token } from "../types";

export interface AiAttribution {
  model: string;
  modelLabel: string;
}

export interface AiPolicyResult extends AiAttribution {
  daily_limit: number | null;
  per_payment_limit: number | null;
  schedule: "Weekly" | "Biweekly" | "Milestone" | null;
  schedule_details: string | null;
  recipient_caps: Array<{ name: string; cap: number }>;
  summary: string[];
  warnings: string[];
  ambiguities: string[];
  requires_clarification: boolean;
  too_vague: boolean;
  clarification_message: string | null;
}

export interface AiRouteResult extends AiAttribution {
  chain: Chain;
  token: Token;
  reason: string;
  region_rationale: string;
  gas_comparison: string;
  observed_at: string;
  confidence: "high" | "medium" | "low";
}

export interface AiAnomalyAnalysis extends AiAttribution {
  meaning: string;
  likely_cause: "configuration_issue" | "compromised_agent" | "normal_behavior";
  cause_reasoning: string;
  actions: [string, string];
  severity: "Low" | "Medium" | "High";
  severity_reasoning: string;
}

export interface AiTextResult extends AiAttribution {
  text: string;
}

export interface AiPayrollReportResult extends AiTextResult {
  recommendation_code: string;
  evidence: {
    source: string;
    finality: string;
    observed_at: string;
    block_height_min: number;
    block_height_max: number;
  };
}

export type SecurityScenarioKind =
  | "unapproved_recipient"
  | "over_limit_payment"
  | "suspended_recipient"
  | "daily_limit_breach"
  | "off_hours_payment";

export interface AiSecurityScenario {
  kind: SecurityScenarioKind;
  title: string;
  description: string;
  expected_protection: string;
}

interface NearAiProxyResponse<T> {
  result?: T;
  model?: string;
  model_label?: string;
  error?: string;
}

export async function generatePolicy(description: string): Promise<AiPolicyResult> {
  return withAttribution(await requestNearAi<Omit<AiPolicyResult, keyof AiAttribution>>("policy", {
    description,
  }));
}

export async function analyzeAnomaly(
  contractId: string,
  anomalyId: number,
): Promise<AiAnomalyAnalysis> {
  return withAttribution(
    await requestNearAi<Omit<AiAnomalyAnalysis, keyof AiAttribution>>("anomaly", {
      contract_id: contractId,
      anomaly_id: anomalyId,
    }),
  );
}

export async function generatePayrollReport(options: {
  contractId: string;
}): Promise<AiPayrollReportResult> {
  return withAttribution(
    await requestNearAi<Omit<AiPayrollReportResult, keyof AiAttribution>>("payroll-report", {
      contract_id: options.contractId,
    }),
  );
}

export async function optimizeRoute(options: {
  selectedChain: Chain;
  selectedToken: Token;
  region?: string;
}): Promise<AiRouteResult> {
  return withAttribution(
    await requestNearAi<Omit<AiRouteResult, keyof AiAttribution>>("route", {
      selected_chain: options.selectedChain,
      selected_token: options.selectedToken,
      region: options.region?.trim() || undefined,
    }),
  );
}

export async function generateSecuritySummary(options: {
  contractId: string;
  scenarios: AiSecurityScenario[];
  results: Array<{ scenario: string; blocked: boolean; reason: string }>;
}): Promise<AiTextResult> {
  return withAttribution(
    await requestNearAi<{ text: string }>("security-summary", {
      contract_id: options.contractId,
      scenarios: options.scenarios,
      results: options.results,
    }),
  );
}

async function requestNearAi<T extends object>(
  task: string,
  input: unknown,
): Promise<NearAiProxyResponse<T>> {
  let response: Response;
  try {
    response = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, input }),
      signal: AbortSignal.timeout(58_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("NEAR AI took too long to respond. Please try again.");
    }
    throw error;
  }
  const payload = (await response.json().catch(() => null)) as NearAiProxyResponse<T> | null;
  if (!response.ok || payload?.result === undefined) {
    throw new Error(payload?.error || `NEAR AI request failed with HTTP ${response.status}`);
  }
  return payload;
}

function withAttribution<T extends object>(payload: NearAiProxyResponse<T>): T & AiAttribution {
  if (payload.result === undefined) throw new Error("NEAR AI returned no result");
  const model = payload.model || "unknown";
  return Object.assign(payload.result, {
    model,
    modelLabel: payload.model_label || displayModelName(model),
  }) as T & AiAttribution;
}

function displayModelName(model: string): string {
  if (model.includes("Llama-3.3")) return "Llama 3.3";
  if (model.includes("DeepSeek-V4.1")) return "DeepSeek V4.1 Flash";
  return model.split("/").at(-1)?.replaceAll("-", " ") || "NEAR AI";
}
