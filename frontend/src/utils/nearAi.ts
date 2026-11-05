import type { AnomalyEntry, AuditEntry, Chain, Token } from "../types";

export interface AiPolicyResult {
  daily_limit: number | null;
  per_payment_limit: number | null;
  schedule: "Weekly" | "Biweekly" | "Milestone" | null;
  recipient_caps: Array<{ name: string; cap: number }>;
  summary: string[];
  warnings: string[];
}

export interface AiRouteResult {
  chain: Chain;
  token: Token;
  reason: string;
  confidence: "high" | "medium";
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

interface AiTextResult {
  text: string;
}

interface AiSecurityScenarioResult {
  scenarios: AiSecurityScenario[];
}

export async function generatePolicy(description: string): Promise<AiPolicyResult> {
  return requestNearAi<AiPolicyResult>("policy", { description });
}

export async function analyzeAnomaly(
  anomaly: AnomalyEntry,
  recentPayments: AuditEntry[],
): Promise<string> {
  const milliseconds = BigInt(String(anomaly.timestamp)) / 1_000_000n;
  const result = await requestNearAi<AiTextResult>("anomaly", {
    anomaly_type: anomaly.anomaly_type,
    description: anomaly.description,
    timestamp: new Date(Number(milliseconds)).toISOString(),
    recent_payments: recentPayments.slice(0, 30),
  });
  return result.text;
}

export async function generatePayrollReport(options: {
  contractId: string;
  auditEntries: AuditEntry[];
  anomalies: AnomalyEntry[];
}): Promise<string> {
  const result = await requestNearAi<AiTextResult>("payroll-report", {
    contract_id: options.contractId,
    audit_entries: options.auditEntries.slice(0, 30),
    anomalies: options.anomalies.slice(0, 30),
  });
  return result.text;
}

export async function optimizeRoute(options: {
  selectedChain: Chain;
  selectedToken: Token;
  region?: string;
}): Promise<AiRouteResult> {
  return requestNearAi<AiRouteResult>("route", {
    selected_chain: options.selectedChain,
    selected_token: options.selectedToken,
    region: options.region?.trim() || undefined,
  });
}

export async function generateSecurityScenarios(
  contractId: string,
): Promise<AiSecurityScenario[]> {
  const result = await requestNearAi<AiSecurityScenarioResult>("security-scenarios", {
    contract_id: contractId,
  });
  return result.scenarios;
}

async function requestNearAi<T>(task: string, input: unknown): Promise<T> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task, input }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json().catch(() => null)) as
    | { result?: T; error?: string }
    | null;
  if (!response.ok || payload?.result === undefined) {
    throw new Error(payload?.error || `NEAR AI request failed with HTTP ${response.status}`);
  }
  return payload.result;
}
