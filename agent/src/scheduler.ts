import { detectAnomalies } from "./anomaly.js";
import type { config as configType } from "./config.js";
import type { IntentClient } from "./intents.js";
import { errorMessage, logger } from "./logger.js";
import type { NearClient } from "./near.js";
import { loadPayroll } from "./payroll.js";
import { generateDailyReport } from "./reporter.js";
import type { StateStore } from "./state.js";
import { triggerDuePayments } from "./trigger.js";

type AgentConfig = typeof configType;

export class Scheduler {
  readonly #config: AgentConfig;
  readonly #near: NearClient;
  readonly #intents: IntentClient;
  readonly #state: StateStore;
  #stopping = false;

  constructor(options: {
    config: AgentConfig;
    near: NearClient;
    intents: IntentClient;
    state: StateStore;
  }) {
    this.#config = options.config;
    this.#near = options.near;
    this.#intents = options.intents;
    this.#state = options.state;
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
    const payroll = await loadPayroll(this.#config.payrollConfigPath);
    const [recipients, auditLog, dailySpent, dailyLimit] = await Promise.all([
      this.#near.getRecipients(),
      this.#near.getAuditLog(100),
      this.#near.getDailySpent(),
      this.#near.getDailyLimit(),
    ]);

    const anomalyResult = detectAnomalies({
      auditLog,
      dailySpent: BigInt(dailySpent),
      dailyLimit: BigInt(dailyLimit),
      payroll,
      state: this.#state.value,
      now,
    });
    for (const anomaly of anomalyResult.anomalies) {
      logger.warn("anomaly.detected", {
        type: anomaly.type,
        severity: anomaly.severity,
        description: anomaly.description,
      });
    }
    await this.#state.setRouteFingerprints(anomalyResult.routeFingerprints);

    await triggerDuePayments({
      near: this.#near,
      intents: this.#intents,
      state: this.#state,
      payroll,
      recipients,
      now,
    });

    const reportPath = await generateDailyReport({
      state: this.#state,
      anomalies: anomalyResult.anomalies,
      reportDirectory: this.#config.reportDirectory,
      ownerId: this.#config.reportOwnerId,
      now,
    });
    if (reportPath) {
      logger.info("report.generated", { path: reportPath });
    }
    logger.info("scheduler.cycle_complete", { recipients: recipients.length });
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
