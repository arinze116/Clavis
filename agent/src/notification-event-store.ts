import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

interface ContractNotificationEvents {
  baselined: boolean;
  decisionIds: number[];
  anomalyIds: number[];
}

interface NotificationEventState {
  version: 1;
  contracts: Record<string, ContractNotificationEvents>;
}

const MAX_TRACKED_IDS = 500;

export class NotificationEventStore {
  readonly #path: string;
  #state: NotificationEventState = { version: 1, contracts: {} };
  #saveQueue: Promise<void> = Promise.resolve();

  constructor(statePath: string) {
    this.#path = statePath;
  }

  async load(): Promise<void> {
    try {
      const source = await readFile(this.#path, "utf8");
      const value = JSON.parse(source) as Partial<NotificationEventState>;
      if (value.version !== 1 || !value.contracts) {
        throw new Error("Unsupported notification event state");
      }
      this.#state = { version: 1, contracts: value.contracts };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.#queueSave();
    }
  }

  async baseline(contractId: string, decisionIds: number[], anomalyIds: number[]): Promise<void> {
    const current = this.#state.contracts[contractId];
    this.#state.contracts[contractId] = {
      baselined: true,
      decisionIds: uniqueRecent([...(current?.decisionIds ?? []), ...decisionIds]),
      anomalyIds: uniqueRecent([...(current?.anomalyIds ?? []), ...anomalyIds]),
    };
    await this.#queueSave();
  }

  hasBaseline(contractId: string): boolean {
    return this.#state.contracts[contractId]?.baselined === true;
  }

  async claimDecision(contractId: string, paymentId: number): Promise<boolean> {
    return this.#claim(contractId, "decisionIds", paymentId);
  }

  async claimAnomaly(contractId: string, anomalyId: number): Promise<boolean> {
    return this.#claim(contractId, "anomalyIds", anomalyId);
  }

  async #claim(
    contractId: string,
    key: "decisionIds" | "anomalyIds",
    eventId: number,
  ): Promise<boolean> {
    const events = (this.#state.contracts[contractId] ??= {
      baselined: false,
      decisionIds: [],
      anomalyIds: [],
    });
    if (events[key].includes(eventId)) return false;
    events[key] = uniqueRecent([...events[key], eventId]);
    await this.#queueSave();
    return true;
  }

  #queueSave(): Promise<void> {
    this.#saveQueue = this.#saveQueue.then(async () => {
      await mkdir(path.dirname(this.#path), { recursive: true });
      const temporaryPath = `${this.#path}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(this.#state, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, this.#path);
    });
    return this.#saveQueue;
  }
}

function uniqueRecent(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0))]
    .sort((left, right) => left - right)
    .slice(-MAX_TRACKED_IDS);
}
