import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  IntentEnvelope,
  IntentRecord,
  IntentStatus,
  IntentSubmission,
} from "./types.js";

interface IntentFile {
  version: 1;
  intents: IntentRecord[];
}

const EMPTY_FILE: IntentFile = { version: 1, intents: [] };

export class IntentStore {
  readonly #path: string;
  #file: IntentFile = structuredClone(EMPTY_FILE);

  constructor(filePath: string) {
    this.#path = filePath;
  }

  get records(): readonly IntentRecord[] {
    return this.#file.intents;
  }

  async load(): Promise<void> {
    try {
      const source = await readFile(this.#path, "utf8");
      const parsed = JSON.parse(source) as IntentFile;
      if (parsed.version !== 1 || !Array.isArray(parsed.intents)) {
        throw new Error("Unsupported intents state file");
      }
      this.#file = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.save();
    }
  }

  async ensurePending(envelope: IntentEnvelope): Promise<IntentRecord> {
    const existing = this.find(envelope.intentId);
    if (existing) return existing;
    const record: IntentRecord = {
      ...envelope,
      status: "PENDING",
      attempts: 0,
      updatedAt: new Date().toISOString(),
    };
    this.#file.intents.push(record);
    await this.save();
    return record;
  }

  async recordSubmission(
    intentId: string,
    submission: IntentSubmission,
  ): Promise<IntentRecord> {
    const record = this.require(intentId);
    record.attempts += 1;
    record.status = submission.status;
    record.reference = submission.reference;
    if (submission.transactionHash) {
      record.transactionHash = submission.transactionHash;
    } else {
      delete record.transactionHash;
    }
    record.fallback = submission.fallback;
    delete record.lastError;
    delete record.nextRetryAt;
    record.updatedAt = new Date().toISOString();
    await this.save();
    return record;
  }

  async markStatus(intentId: string, status: IntentStatus): Promise<IntentRecord> {
    const record = this.require(intentId);
    record.status = status;
    record.updatedAt = new Date().toISOString();
    await this.save();
    return record;
  }

  async markFailed(
    intentId: string,
    message: string,
    retryDelayMs: number,
  ): Promise<IntentRecord> {
    const record = this.require(intentId);
    record.attempts += 1;
    record.status = "FAILED";
    record.lastError = message.slice(0, 500);
    record.nextRetryAt = new Date(Date.now() + retryDelayMs).toISOString();
    record.updatedAt = new Date().toISOString();
    await this.save();
    return record;
  }

  async markRelayFailed(
    intentId: string,
    message: string,
    retryDelayMs: number,
  ): Promise<IntentRecord> {
    const record = this.require(intentId);
    record.status = "FAILED";
    record.lastError = message.slice(0, 500);
    record.nextRetryAt = new Date(Date.now() + retryDelayMs).toISOString();
    record.updatedAt = new Date().toISOString();
    await this.save();
    return record;
  }

  find(intentId: string): IntentRecord | undefined {
    return this.#file.intents.find((record) => record.intentId === intentId);
  }

  private require(intentId: string): IntentRecord {
    const record = this.find(intentId);
    if (!record) throw new Error(`Intent ${intentId} is not tracked`);
    return record;
  }

  private async save(): Promise<void> {
    await mkdir(path.dirname(this.#path), { recursive: true });
    const temporaryPath = `${this.#path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.#file, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.#path);
  }
}
