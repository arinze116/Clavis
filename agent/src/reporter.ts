import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StateStore } from "./state.js";
import type { Anomaly, DailyReportSummary } from "./types.js";

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DailyReportResult {
  path: string;
  reportDate: string;
  summary: DailyReportSummary;
}

export async function generateDailyReport(options: {
  state: StateStore;
  anomalies: Anomaly[];
  reportDirectory: string;
  contractId: string;
  now?: Date;
  force?: boolean;
}): Promise<DailyReportResult | null> {
  const now = options.now ?? new Date();
  const date = utcDate(now);
  const isMidnightWindow = now.getUTCHours() === 0;
  if (!options.force && (!isMidnightWindow || options.state.value.lastReportDate === date)) {
    return null;
  }

  const dayStart = Date.parse(`${date}T00:00:00.000Z`);
  const recentPayments = options.state.value.payments.filter(
    (payment) =>
      payment.approvedAt >= dayStart - 86_400_000 && payment.approvedAt < dayStart,
  );
  const summary: DailyReportSummary = {
    approvedPayments: recentPayments.length,
    deliveredPayments: recentPayments.filter(
      (payment) => payment.status === "DELIVERED",
    ).length,
    deliveryFailures: recentPayments.filter(
      (payment) => payment.status === "DELIVERY_FAILED",
    ).length,
    authorizedAmountYocto: recentPayments
      .reduce((sum, payment) => sum + BigInt(payment.amountYocto), 0n)
      .toString(),
  };
  const report = {
    reportDate: date,
    contractId: options.contractId,
    generatedAt: now.toISOString(),
    summary,
    payments: recentPayments,
    anomalies: options.anomalies,
  };

  const contractDirectory = path.join(options.reportDirectory, options.contractId);
  await mkdir(contractDirectory, { recursive: true });
  const reportPath = path.join(contractDirectory, `payroll-${date}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await options.state.setLastReportDate(date);
  return { path: reportPath, reportDate: date, summary };
}
