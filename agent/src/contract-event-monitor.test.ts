import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, expect, test, vi } from "vitest";

import { ContractEventMonitor } from "./contract-event-monitor.js";
import type { FactoryClient } from "./near.js";
import type { NotificationEventStore } from "./notification-event-store.js";
import type { NotificationManager } from "./notifications/index.js";

const originalFetch = globalThis.fetch;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

test("notification monitoring reads the newest anomaly page", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "clavis-contract-monitor-"));
  temporaryDirectories.push(directory);
  const payrollConfigPath = path.join(directory, "payroll.json");
  await writeFile(payrollConfigPath, '{"businesses":[]}\n', "utf8");

  const anomalyArguments: Array<Record<string, unknown>> = [];
  globalThis.fetch = vi.fn(async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as {
      params?: { method_name?: string; args_base64?: string };
    };
    const methodName = request.params?.method_name;
    const args = request.params?.args_base64
      ? JSON.parse(Buffer.from(request.params.args_base64, "base64").toString("utf8")) as Record<string, unknown>
      : {};
    if (methodName === "get_anomalies") anomalyArguments.push(args);
    const value = methodName === "get_anomaly_count"
      ? 101
      : methodName === "get_anomalies"
        ? [
            {
              anomaly_id: 101,
              timestamp: "1",
              anomaly_type: "HIGH_FREQUENCY",
              severity: "HIGH",
              description: "Newest anomaly",
              reviewed: false,
            },
          ]
        : [];
    return new Response(
      JSON.stringify({ result: { result: [...Buffer.from(JSON.stringify(value), "utf8")] } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  const baseline = vi.fn(async () => undefined);
  const monitor = new ContractEventMonitor({
    factory: {
      getAllContracts: vi.fn(async () => [
        {
          name: "payroll",
          contract_id: "payroll.testnet",
          owner: "owner.testnet",
          created_at: 1,
        },
      ]),
    } as unknown as FactoryClient,
    rpcUrl: "https://rpc.testnet.near.org",
    payrollConfigPath,
    payrollDirectory: directory,
    pollIntervalMs: 10_000,
    notifications: {} as NotificationManager,
    events: {
      hasBaseline: vi.fn(() => false),
      baseline,
    } as unknown as NotificationEventStore,
  });

  await monitor.runCycle(true);

  expect(anomalyArguments).toEqual([{ from: 1, limit: 100, active_only: false }]);
  expect(baseline).toHaveBeenCalledWith("payroll.testnet", [], [101]);
});
