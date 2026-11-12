import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AgentState, IntentEnvelope, PaymentRecord, RequestRecord } from "./types.js";

const EMPTY_STATE: AgentState = {
  version: 1,
  lastReportDate: null,
  routeFingerprints: {},
  completedMilestones: {},
  anomalyNotifications: {},
  requests: [],
  payments: [],
  pendingIntents: [],
};

export class StateStore {
  readonly #path: string;
  #state: AgentState = structuredClone(EMPTY_STATE);

  constructor(statePath: string) {
    this.#path = statePath;
  }

  get value(): Readonly<AgentState> {
    return this.#state;
  }

  async load(): Promise<void> {
    try {
      const source = await readFile(this.#path, "utf8");
      const value = JSON.parse(source) as Partial<AgentState>;
      if (value.version !== 1) {
        throw new Error("Unsupported agent state version");
      }
      this.#state = {
        ...structuredClone(EMPTY_STATE),
        ...value,
        routeFingerprints: value.routeFingerprints ?? {},
        completedMilestones: value.completedMilestones ?? {},
        anomalyNotifications: value.anomalyNotifications ?? {},
        requests: value.requests ?? [],
        payments: value.payments ?? [],
        pendingIntents: value.pendingIntents ?? [],
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
      await this.save();
    }
  }

  async recordRequest(record: RequestRecord): Promise<void> {
    const cutoff = record.timestamp - 3_600_000;
    this.#state.requests = [...this.#state.requests.filter((item) => item.timestamp >= cutoff), record];
    await this.save();
  }

  async recordPayment(
    record: PaymentRecord,
    intents: IntentEnvelope[],
    milestone?: { recipientHash: string; milestoneId: string },
  ): Promise<void> {
    this.#state.payments = [...this.#state.payments.slice(-999), record];
    this.#state.pendingIntents.push(...intents);
    if (milestone) {
      this.#state.completedMilestones[milestone.recipientHash] = milestone.milestoneId;
    }
    await this.save();
  }

  async markMilestoneCompleted(recipientHash: string, milestoneId: string): Promise<void> {
    this.#state.completedMilestones[recipientHash] = milestoneId;
    await this.save();
  }

  async markIntentFilled(intentId: string): Promise<void> {
    const completedIntent = this.#state.pendingIntents.find(
      (intent) => intent.intentId === intentId,
    );
    this.#state.pendingIntents = this.#state.pendingIntents.filter(
      (intent) => intent.intentId !== intentId,
    );
    const paymentId = completedIntent?.paymentId;
    if (paymentId === undefined) {
      await this.save();
      return;
    }
    const stillPending = this.#state.pendingIntents.some(
      (intent) => intent.paymentId === paymentId,
    );
    if (!stillPending) {
      const payment = this.#state.payments.find((item) => item.paymentId === paymentId);
      if (payment && payment.status !== "DELIVERY_FAILED") {
        payment.status = "DELIVERED";
      }
    }
    await this.save();
  }

  async markIntentTerminalFailure(intentId: string): Promise<void> {
    const failedIntent = this.#state.pendingIntents.find(
      (intent) => intent.intentId === intentId,
    );
    this.#state.pendingIntents = this.#state.pendingIntents.filter(
      (intent) => intent.intentId !== intentId,
    );
    const payment = this.#state.payments.find(
      (item) => item.paymentId === failedIntent?.paymentId,
    );
    if (payment) payment.status = "DELIVERY_FAILED";
    await this.save();
  }

  async shouldNotifyAnomaly(
    fingerprint: string,
    timestamp: number,
    cooldownMs = 300_000,
  ): Promise<boolean> {
    const previous = this.#state.anomalyNotifications[fingerprint] ?? 0;
    return timestamp - previous >= cooldownMs;
  }

  async markAnomalyNotified(fingerprint: string, timestamp: number): Promise<void> {
    this.#state.anomalyNotifications[fingerprint] = timestamp;
    await this.save();
  }

  async setRouteFingerprints(fingerprints: Record<string, string>): Promise<void> {
    this.#state.routeFingerprints = fingerprints;
    await this.save();
  }

  async setLastReportDate(date: string): Promise<void> {
    this.#state.lastReportDate = date;
    await this.save();
  }

  private async save(): Promise<void> {
    await mkdir(path.dirname(this.#path), { recursive: true });
    const temporaryPath = `${this.#path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.#state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.#path);
  }
}
