import type { AgentState, Anomaly, AuditEntry, PayrollFile } from "./types.js";
import { routeFingerprint } from "./intents.js";

export interface AnomalyInput {
  auditLog: AuditEntry[];
  dailySpent: bigint;
  dailyLimit: bigint;
  payroll: PayrollFile;
  state: Readonly<AgentState>;
  now?: Date;
}

export interface AnomalyResult {
  anomalies: Anomaly[];
  routeFingerprints: Record<string, string>;
}

export function detectAnomalies(input: AnomalyInput): AnomalyResult {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const anomalies: Anomaly[] = [];
  const lastHour = input.auditLog.filter(
    (entry) => nowMs - Math.floor(entry.timestamp / 1_000_000) <= 3_600_000,
  );

  if (lastHour.length > 10) {
    anomalies.push({
      type: "HIGH_FREQUENCY",
      severity: "HIGH",
      description: `${lastHour.length} payment requests in the last hour`,
      timestamp: nowMs,
    });
  }

  const hasOffHoursActivity = lastHour.some((entry) => {
    const hour = new Date(Math.floor(entry.timestamp / 1_000_000)).getUTCHours();
    return hour >= 0 && hour < 4;
  });
  if (hasOffHoursActivity) {
    anomalies.push({
      type: "OFF_HOURS",
      severity: "MEDIUM",
      description: "Payment activity occurred between 00:00 and 04:00 UTC",
      timestamp: nowMs,
    });
  }

  if (input.dailyLimit > 0n && input.dailySpent * 100n >= input.dailyLimit * 90n) {
    const percentage = Number((input.dailySpent * 100n) / input.dailyLimit);
    anomalies.push({
      type: "NEAR_DAILY_LIMIT",
      severity: "MEDIUM",
      description: `${percentage}% of the daily authorization limit is used`,
      timestamp: nowMs,
    });
  }

  const routeFingerprints: Record<string, string> = {};
  for (const recipient of input.payroll.recipients) {
    const current = routeFingerprint(recipient.destinations);
    routeFingerprints[recipient.recipientHash] = current;
    const previous = input.state.routeFingerprints[recipient.recipientHash];
    if (previous && previous !== current) {
      anomalies.push({
        type: "RECIPIENT_ROUTE_CHANGED",
        severity: "HIGH",
        description: "A private recipient destination changed since the previous cycle",
        timestamp: nowMs,
      });
    }
  }

  const requests = [...input.state.requests].sort((a, b) => a.timestamp - b.timestamp);
  for (let index = 1; index < requests.length; index += 1) {
    const current = requests[index];
    const previous = requests[index - 1];
    if (
      current &&
      previous &&
      current.recipientHash === previous.recipientHash &&
      current.timestamp - previous.timestamp < 60_000
    ) {
      anomalies.push({
        type: "POSSIBLE_REPLAY",
        severity: "HIGH",
        description: "The same recipient was requested twice within one minute",
        timestamp: nowMs,
      });
      break;
    }
  }

  return { anomalies, routeFingerprints };
}
