import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Anomaly } from "./types.js";
import type { StateStore } from "./state.js";

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function generateDailyReport(options: {
  state: StateStore;
  anomalies: Anomaly[];
  reportDirectory: string;
  ownerId: string;
  now?: Date;
  force?: boolean;
}): Promise<string | null> {
  const now = options.now ?? new Date();
  const date = utcDate(now);
  const isMidnightWindow = now.getUTCHours() === 0;
  if (
    !options.force &&
    (!isMidnightWindow || options.state.value.lastReportDate === date)
  ) {
    return null;
  }

  const dayStart = Date.parse(`${date}T00:00:00.000Z`);
  const recentPayments = options.state.value.payments.filter(
    (payment) => payment.approvedAt >= dayStart - 86_400_000 && payment.approvedAt < dayStart,
  );
  const report = {
    reportDate: date,
    owner: options.ownerId,
    generatedAt: now.toISOString(),
    summary: {
      approvedPayments: recentPayments.length,
      deliveredPayments: recentPayments.filter((payment) => payment.status === "DELIVERED").length,
      deliveryFailures: recentPayments.filter(
        (payment) => payment.status === "DELIVERY_FAILED",
      ).length,
      authorizedAmountYocto: recentPayments
        .reduce((sum, payment) => sum + BigInt(payment.amountYocto), 0n)
        .toString(),
    },
    payments: recentPayments,
    anomalies: options.anomalies,
  };

  await mkdir(options.reportDirectory, { recursive: true });
  const reportPath = path.join(options.reportDirectory, `payroll-${date}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await options.state.setLastReportDate(date);
  return reportPath;
}
