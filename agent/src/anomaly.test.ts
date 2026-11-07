import { describe, expect, it } from "vitest";

import { detectAnomalies } from "./anomaly.js";
import type { AgentState, AuditEntry, BusinessPayroll } from "./types.js";
import { routeFingerprint } from "./intents.js";

const recipientHash = "a".repeat(64);
const now = new Date("2026-11-01T02:30:00.000Z");

function state(overrides: Partial<AgentState> = {}): AgentState {
  return {
    version: 1,
    lastReportDate: null,
    routeFingerprints: {},
    completedMilestones: {},
    anomalyNotifications: {},
    requests: [],
    payments: [],
    pendingIntents: [],
    ...overrides,
  };
}

function payroll(): BusinessPayroll {
  return {
    contract_id: "acme.clavis.testnet",
    owner_email: "owner@example.com",
    recipients: [
      {
        recipientHash,
        name: "Worker",
        nearAddress: "worker.testnet",
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
      lastResetTimestampNanoseconds: BigInt(now.getTime()) * 1_000_000n,
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
      lastResetTimestampNanoseconds: BigInt(now.getTime()) * 1_000_000n,
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
      lastResetTimestampNanoseconds: BigInt(now.getTime()) * 1_000_000n,
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

  it("matches the contract off-hours window through 05:59 UTC", () => {
    const requestTime = new Date("2026-11-01T05:00:00.000Z");
    const result = detectAnomalies({
      auditLog: [
        {
          payment_id: 1,
          timestamp: requestTime.getTime() * 1_000_000,
          outcome: "Approved",
          block_height: 100,
        },
      ],
      dailySpent: 0n,
      dailyLimit: 100n,
      lastResetTimestampNanoseconds: BigInt(requestTime.getTime()) * 1_000_000n,
      payroll: payroll(),
      state: state(),
      now: new Date("2026-11-01T05:30:00.000Z"),
    });

    expect(result.anomalies.some((item) => item.type === "OFF_HOURS")).toBe(true);
  });

  it("does not reuse authorization spend from an expired daily window", () => {
    const result = detectAnomalies({
      auditLog: [],
      dailySpent: 90n,
      dailyLimit: 100n,
      lastResetTimestampNanoseconds:
        BigInt(now.getTime() - 25 * 60 * 60 * 1_000) * 1_000_000n,
      payroll: payroll(),
      state: state(),
      now,
    });

    expect(result.anomalies.some((item) => item.type === "NEAR_DAILY_LIMIT")).toBe(false);
  });

  it("does not count fixed security probes as payroll requests", () => {
    const probes = auditEntries(11).map((entry) => ({
      ...entry,
      outcome: { Rejected: "Security audit: Recipient not approved" } as const,
    }));
    const result = detectAnomalies({
      auditLog: probes,
      dailySpent: 0n,
      dailyLimit: 100n,
      lastResetTimestampNanoseconds: BigInt(now.getTime()) * 1_000_000n,
      payroll: payroll(),
      state: state(),
      now,
    });

    expect(result.anomalies.some((item) => item.type === "HIGH_FREQUENCY")).toBe(false);
    expect(result.anomalies.some((item) => item.type === "OFF_HOURS")).toBe(false);
  });
});
