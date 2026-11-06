import type { FactoryClient } from "./near.js";
import { NearRpcClient } from "./near.js";
import type { NotificationEventStore } from "./notification-event-store.js";
import type { NotificationManager } from "./notifications/index.js";
import { errorMessage, logger } from "./logger.js";
import { loadBusinessPayroll, loadPayrollCatalog } from "./payroll.js";
import type {
  AuditEntry,
  BusinessPayroll,
  ContractAnomalyEntry,
  ContractRecord,
  PayrollFile,
} from "./types.js";

export class ContractEventMonitor {
  readonly #factory: FactoryClient;
  readonly #rpc: NearRpcClient;
  readonly #payrollConfigPath: string;
  readonly #payrollDirectory: string;
  readonly #pollIntervalMs: number;
  readonly #notifications: NotificationManager;
  readonly #events: NotificationEventStore;
  #stopping = false;

  constructor(options: {
    factory: FactoryClient;
    rpcUrl: string;
    payrollConfigPath: string;
    payrollDirectory: string;
    pollIntervalMs: number;
    notifications: NotificationManager;
    events: NotificationEventStore;
  }) {
    this.#factory = options.factory;
    this.#rpc = new NearRpcClient(options.rpcUrl);
    this.#payrollConfigPath = options.payrollConfigPath;
    this.#payrollDirectory = options.payrollDirectory;
    this.#pollIntervalMs = options.pollIntervalMs;
    this.#notifications = options.notifications;
    this.#events = options.events;
  }

  stop(): void {
    this.#stopping = true;
  }

  async initialize(): Promise<void> {
    await this.#events.load();
    try {
      await this.runCycle(true);
    } catch (error) {
      logger.error("notification_events.baseline_failed", { error: errorMessage(error) });
    }
  }

  async start(): Promise<void> {
    while (!this.#stopping) {
      await delay(this.#pollIntervalMs);
      if (this.#stopping) break;
      try {
        await this.runCycle(false);
      } catch (error) {
        logger.error("notification_events.cycle_failed", { error: errorMessage(error) });
      }
    }
  }

  async runCycle(baselineOnly = false): Promise<void> {
    const [catalog, factoryContracts] = await Promise.all([
      loadPayrollCatalog(this.#payrollConfigPath),
      this.#factory.getAllContracts(),
    ]);
    for (const contract of mergeContracts(factoryContracts, catalog)) {
      try {
        await this.#checkContract(contract, catalog, baselineOnly);
      } catch (error) {
        logger.error("notification_events.contract_failed", {
          contractId: contract.contract_id,
          error: errorMessage(error),
        });
      }
    }
  }

  async #checkContract(
    contract: ContractRecord,
    catalog: PayrollFile,
    baselineOnly: boolean,
  ): Promise<void> {
    const business =
      (await loadBusinessPayroll({
        contractId: contract.contract_id,
        payrollDirectory: this.#payrollDirectory,
        catalog,
      })) ??
      ({
        contract_id: contract.contract_id,
        owner_email: "notifications-disabled@example.com",
        telegram_chat_id: undefined,
        recipients: [],
      } satisfies BusinessPayroll);

    const [decisions, anomalies] = await Promise.all([
      this.#rpc.view<AuditEntry[]>(contract.contract_id, "get_audit_log_reverse", {
        from: 0,
        limit: 100,
      }),
      this.#rpc.view<ContractAnomalyEntry[]>(contract.contract_id, "get_anomalies", {
        from: 0,
        limit: 100,
        active_only: false,
      }),
    ]);

    if (baselineOnly || !this.#events.hasBaseline(contract.contract_id)) {
      await this.#events.baseline(
        contract.contract_id,
        decisions.map((entry) => entry.payment_id),
        anomalies.map((entry) => entry.anomaly_id),
      );
      return;
    }

    await this.#notifyDecisions(contract, business, decisions);
    await this.#notifyAnomalies(contract, business, anomalies);
  }

  async #notifyDecisions(
    contract: ContractRecord,
    business: BusinessPayroll,
    decisions: AuditEntry[],
  ): Promise<void> {
    for (const decision of [...decisions].sort((left, right) => left.payment_id - right.payment_id)) {
      if (!(await this.#events.claimDecision(contract.contract_id, decision.payment_id))) continue;
      await this.#notifications.contractDecisionDetected({
        business,
        paymentId: decision.payment_id,
        approved: decision.outcome === "Approved",
        ...(typeof decision.outcome === "object"
          ? { reason: decision.outcome.Rejected }
          : {}),
        ...(contract.owner ? { ownerAccountId: contract.owner } : {}),
      });
      logger.info("notification_events.decision_sent", {
        contractId: contract.contract_id,
        paymentId: decision.payment_id,
      });
    }
  }

  async #notifyAnomalies(
    contract: ContractRecord,
    business: BusinessPayroll,
    anomalies: ContractAnomalyEntry[],
  ): Promise<void> {
    for (const anomaly of [...anomalies].sort((left, right) => left.anomaly_id - right.anomaly_id)) {
      if (!(await this.#events.claimAnomaly(contract.contract_id, anomaly.anomaly_id))) continue;
      await this.#notifications.contractAnomalyDetected({
        business,
        anomaly,
        ...(contract.owner ? { ownerAccountId: contract.owner } : {}),
      });
      logger.info("notification_events.anomaly_sent", {
        contractId: contract.contract_id,
        anomalyId: anomaly.anomaly_id,
      });
    }
  }
}

function mergeContracts(factoryContracts: ContractRecord[], catalog: PayrollFile): ContractRecord[] {
  const contracts = new Map(factoryContracts.map((contract) => [contract.contract_id, contract]));
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
