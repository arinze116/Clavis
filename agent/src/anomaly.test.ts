import { describe, expect, it } from "vitest";

import { detectAnomalies } from "./anomaly.js";
import type { AgentState, AuditEntry, PayrollFile } from "./types.js";
import { routeFingerprint } from "./intents.js";

const recipientHash = "a".repeat(64);
const now = new Date("2026-11-01T02:30:00.000Z");

function state(overrides: Partial<AgentState> = {}): AgentState {
  return {
    version: 1,
    lastReportDate: null,
    routeFingerprints: {},
    completedMilestones: {},
    requests: [],
    payments: [],
    pendingIntents: [],
    ...overrides,
  };
}

function payroll(): PayrollFile {
  return {
    version: 1,
    recipients: [
      {
        recipientHash,
        amountYocto: "100",
        milestoneReady: false,
        destinations: [
          {
            chain: "near",
            token: "NEAR",
            address: "worker.testnet",
            percentage: 100,
          },
        ],
      },
    ],
  };
}

function auditEntries(count: number): AuditEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    payment_id: index + 1,
    timestamp: (now.getTime() - index * 1_000) * 1_000_000,
    outcome: "Approved",
    block_height: index + 100,
  }));
}

describe("detectAnomalies", () => {
  it("detects high-frequency, off-hours, and limit pressure", () => {
    const result = detectAnomalies({
      auditLog: auditEntries(11),
      dailySpent: 90n,
      dailyLimit: 100n,
      payroll: payroll(),
      state: state(),
      now,
    });

    expect(result.anomalies.map((item) => item.type)).toEqual(
      expect.arrayContaining(["HIGH_FREQUENCY", "OFF_HOURS", "NEAR_DAILY_LIMIT"]),
    );
  });

  it("detects a changed private destination", () => {
    const currentPayroll = payroll();
    const previousDestinations = [
      { chain: "ethereum" as const, token: "USDC" as const, address: "0x1234", percentage: 100 },
    ];
    const result = detectAnomalies({
      auditLog: [],
      dailySpent: 0n,
      dailyLimit: 100n,
      payroll: currentPayroll,
      state: state({ routeFingerprints: { [recipientHash]: routeFingerprint(previousDestinations) } }),
      now,
    });
    expect(result.anomalies.some((item) => item.type === "RECIPIENT_ROUTE_CHANGED")).toBe(true);
  });

  it("detects rapid duplicate requests", () => {
    const result = detectAnomalies({
      auditLog: [],
      dailySpent: 0n,
      dailyLimit: 100n,
      payroll: payroll(),
      state: state({
        requests: [
          { recipientHash, timestamp: now.getTime() - 30_000 },
          { recipientHash, timestamp: now.getTime() - 1_000 },
        ],
      }),
      now,
    });
    expect(result.anomalies.some((item) => item.type === "POSSIBLE_REPLAY")).toBe(true);
  });
});
