import path from "node:path";

import type { AgentCredentialProvider } from "./agent-credentials.js";
import { detectAnomalies } from "./anomaly.js";
import type { config as configType } from "./config.js";
import type { IntentStore } from "./intent-store.js";
import type { IntentClient } from "./intents.js";
import { errorMessage, logger } from "./logger.js";
import { type FactoryClient, NearClient } from "./near.js";
import type { NotificationEventStore } from "./notification-event-store.js";
import type { NotificationManager } from "./notifications/index.js";
import { loadBusinessPayroll, loadPayrollCatalog } from "./payroll.js";
import { generateDailyReport } from "./reporter.js";
import { StateStore } from "./state.js";
import { triggerDuePayments } from "./trigger.js";
import type { ContractRecord, PayrollFile } from "./types.js";

type AgentConfig = typeof configType;

export class Scheduler {
  readonly #config: AgentConfig;
  readonly #factory: FactoryClient;
  readonly #intents: IntentClient;
  readonly #intentStore: IntentStore;
  readonly #notifications: NotificationManager;
  readonly #notificationEvents: NotificationEventStore;
  readonly #credentials: AgentCredentialProvider;
  readonly #clients = new Map<string, NearClient>();
  readonly #states = new Map<string, StateStore>();
  #stopping = false;

  constructor(options: {
    config: AgentConfig;
    factory: FactoryClient;
    intents: IntentClient;
    intentStore: IntentStore;
    notifications: NotificationManager;
    notificationEvents: NotificationEventStore;
    credentials: AgentCredentialProvider;
  }) {
    this.#config = options.config;
    this.#factory = options.factory;
    this.#intents = options.intents;
    this.#intentStore = options.intentStore;
    this.#notifications = options.notifications;
    this.#notificationEvents = options.notificationEvents;
    this.#credentials = options.credentials;
  }

  stop(): void {
    this.#stopping = true;
  }

  async start(): Promise<void> {
    do {
      try {
        await this.runCycle();
      } catch (error) {
        logger.error("scheduler.cycle_failed", { error: errorMessage(error) });
        if (!this.#config.runOnce && !this.#stopping) {
          await delay(this.#config.retryDelayMs);
        }
      }

      if (!this.#config.runOnce && !this.#stopping) {
        await delay(this.#config.pollIntervalMs);
      }
    } while (!this.#config.runOnce && !this.#stopping);
  }

  async runCycle(now = new Date()): Promise<void> {
    const [catalog, factoryContracts] = await Promise.all([
      loadPayrollCatalog(this.#config.payrollConfigPath),
      this.#factory.getAllContracts(),
    ]);
    const contracts = mergeContracts(factoryContracts, catalog);
    logger.info("factory.contracts_loaded", { contracts: contracts.length });

    for (const contract of contracts) {
      try {
        await this.runContractCycle(contract, catalog, now);
      } catch (error) {
        logger.error("scheduler.contract_cycle_failed", {
          contractId: contract.contract_id,
          error: errorMessage(error),
        });
      }
    }
  }

  private async runContractCycle(
    contract: ContractRecord,
    catalog: PayrollFile,
    now: Date,
  ): Promise<void> {
    const contractId = contract.contract_id;
    const business = await loadBusinessPayroll({
      contractId,
      payrollDirectory: this.#config.payrollDirectory,
      catalog,
    });
    if (!business) {
      logger.warn("payroll.plan_missing", { contractId });
      return;
    }

    const [near, state] = await Promise.all([
      this.getNearClient(contractId),
      this.getState(contractId),
    ]);
    const [recipients, auditLog, dailySpent, dailyLimit, lastResetTimestamp] = await Promise.all([
      near.getRecipients(),
      near.getAuditLog(100),
      near.getDailySpent(),
      near.getDailyLimit(),
      near.getLastResetTimestamp(),
    ]);

    const anomalyResult = detectAnomalies({
      auditLog,
      dailySpent: BigInt(dailySpent),
      dailyLimit: BigInt(dailyLimit),
      lastResetTimestampNanoseconds: BigInt(Math.trunc(lastResetTimestamp)),
      payroll: business,
      state: state.value,
      now,
    });
    for (const anomaly of anomalyResult.anomalies) {
      logger.warn("anomaly.detected", {
        contractId,
        type: anomaly.type,
        severity: anomaly.severity,
        description: anomaly.description,
      });
      const fingerprint = `${anomaly.type}:${anomaly.description}`;
      if (await state.shouldNotifyAnomaly(fingerprint, anomaly.timestamp)) {
        const delivery = await this.#notifications.anomalyDetected({
          business,
          anomaly,
          ...(contract.owner ? { ownerAccountId: contract.owner } : {}),
        });
        if (delivery.delivered) {
          await state.markAnomalyNotified(fingerprint, anomaly.timestamp);
        }
      }
    }
    await state.setRouteFingerprints(anomalyResult.routeFingerprints);

    await triggerDuePayments({
      contractId,
      near,
      intents: this.#intents,
      intentStore: this.#intentStore,
      state,
      business,
      recipients,
      notifications: this.#notifications,
      claimDecisionNotification: (paymentId) =>
        this.#notificationEvents.claimDecision(contractId, paymentId),
      completeDecisionNotification: (paymentId, delivered) =>
        this.#notificationEvents.completeDecision(contractId, paymentId, delivered),
      ...(contract.owner ? { ownerAccountId: contract.owner } : {}),
      intentRetryDelayMs: this.#config.intentRetryDelayMs,
      now,
    });

    const report = await generateDailyReport({
      state,
      anomalies: anomalyResult.anomalies,
      reportDirectory: this.#config.reportDirectory,
      contractId,
      now,
    });
    if (report) {
      logger.info("report.generated", { contractId, path: report.path });
      await this.#notifications.dailyReport({
        business,
        reportDate: report.reportDate,
        summary: report.summary,
        ...(contract.owner ? { ownerAccountId: contract.owner } : {}),
      });
    }
    logger.info("scheduler.cycle_complete", {
      contractId,
      recipients: recipients.length,
    });
  }

  private async getNearClient(contractId: string): Promise<NearClient> {
    const existing = this.#clients.get(contractId);
    if (existing) return existing;

    const credential = this.#credentials.resolve(contractId);

    const client = new NearClient({
      networkId: this.#config.nearNetwork,
      rpcUrl: this.#config.nearRpcUrl,
      accountId: credential.accountId,
      privateKey: credential.privateKey,
      contractId,
    });
    await client.connect();
    const contractVersion = await client.verifyContractVersion();
    const keyMode = await client.verifyAgentKey();
    logger.info("agent.contract_connected", { contractId, contractVersion, keyMode });
    this.#clients.set(contractId, client);
    return client;
  }

  private async getState(contractId: string): Promise<StateStore> {
    const existing = this.#states.get(contractId);
    if (existing) return existing;
    const safeName = contractId.replace(/[^a-z0-9.-]/gi, "_");
    const state = new StateStore(path.join(this.#config.dataDirectory, `${safeName}.json`));
    await state.load();
    this.#states.set(contractId, state);
    return state;
  }
}

function mergeContracts(
  factoryContracts: ContractRecord[],
  catalog: PayrollFile,
): ContractRecord[] {
  const contracts = new Map(
    factoryContracts.map((contract) => [contract.contract_id, contract]),
  );
  // Include explicitly configured contracts that are not indexed by the factory.
  // The per-contract v0.3 admission check still decides whether the scheduler may use them.
  for (const business of catalog.businesses) {
    if (!contracts.has(business.contract_id)) {
      contracts.set(business.contract_id, {
        name: business.contract_id.split(".")[0] ?? business.contract_id,
        contract_id: business.contract_id,
        owner: "",
        created_at: 0,
      });
    }
  }
  return [...contracts.values()];
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
