import type { AnomalyEntry, AuditEntry, Chain, Recipient, Token } from "../types";

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
  anomaly: AnomalyEntry,
  recentPayments: AuditEntry[],
): Promise<AiAnomalyAnalysis> {
  const milliseconds = BigInt(String(anomaly.timestamp)) / 1_000_000n;
  return withAttribution(
    await requestNearAi<Omit<AiAnomalyAnalysis, keyof AiAttribution>>("anomaly", {
      anomaly_type: anomaly.anomaly_type,
      contract_severity: anomaly.severity,
      description: anomaly.description,
      timestamp: new Date(Number(milliseconds)).toISOString(),
      recent_payments: recentPayments.slice(0, 30),
    }),
  );
}

export async function generatePayrollReport(options: {
  contractId: string;
  auditEntries: AuditEntry[];
  anomalies: AnomalyEntry[];
  recipients: Recipient[];
  treasuryBalance: string;
  dailySpent: string;
}): Promise<AiTextResult> {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1_000;
  const thisWeekStart = now - weekMs;
  const lastWeekStart = now - weekMs * 2;
  const approvedTimes = options.auditEntries.flatMap((entry) =>
    entry.outcome === "Approved" ? [timestampMilliseconds(entry.timestamp)] : [],
  );
  const thisWeekPayments = approvedTimes.filter((timestamp) => timestamp >= thisWeekStart).length;
  const lastWeekPayments = approvedTimes.filter(
    (timestamp) => timestamp >= lastWeekStart && timestamp < thisWeekStart,
  ).length;
  const percentageChange =
    lastWeekPayments === 0
      ? thisWeekPayments === 0
        ? 0
        : null
      : Number((((thisWeekPayments - lastWeekPayments) / lastWeekPayments) * 100).toFixed(1));
  const rejectionReasons = options.auditEntries.flatMap((entry) =>
    typeof entry.outcome === "object" ? [entry.outcome.Rejected] : [],
  );
  const paidRecipients = options.recipients
    .filter((recipient) => timestampMilliseconds(recipient.last_paid) >= thisWeekStart)
    .map((recipient) => recipient.name);
  const pendingRecipients = options.recipients
    .filter((recipient) => {
      if (!recipient.active) return false;
      if (recipient.next_payment_at === null) return recipient.schedule === "Milestone";
      return timestampMilliseconds(recipient.next_payment_at) <= now;
    })
    .map((recipient) => recipient.name);

  return withAttribution(
    await requestNearAi<{ text: string }>("payroll-report", {
      contract_id: options.contractId,
      generated_at: new Date(now).toISOString(),
      payment_comparison: {
        this_week: thisWeekPayments,
        last_week: lastWeekPayments,
        percentage_change: percentageChange,
        note: percentageChange === null ? "No prior-week payments for a percentage baseline" : null,
      },
      recipients: {
        paid_this_week: paidRecipients,
        pending: pendingRecipients,
        active_total: options.recipients.filter((recipient) => recipient.active).length,
      },
      policy_violations: rejectionReasons,
      anomalies: options.anomalies.slice(0, 30).map((anomaly) => ({
        type: anomaly.anomaly_type,
        severity: anomaly.severity,
        description: anomaly.description,
        reviewed: anomaly.reviewed,
      })),
      treasury_health: {
        runway_days: calculateRunwayDays(options.treasuryBalance, options.dailySpent),
        basis: "Current on-chain treasury balance divided by today's on-chain spend",
      },
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

function timestampMilliseconds(timestamp: number): number {
  if (!timestamp) return 0;
  return Number(BigInt(String(timestamp)) / 1_000_000n);
}

function calculateRunwayDays(balance: string, dailySpent: string): number | null {
  try {
    const balanceYocto = BigInt(balance);
    const spentYocto = BigInt(dailySpent);
    if (balanceYocto <= 0n || spentYocto <= 0n) return null;
    return Number((balanceYocto * 10n) / spentYocto) / 10;
  } catch {
    return null;
  }
}
