import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

const accountIdPattern = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const telegramChatIdPattern = /^-?\d{5,20}$/;
const MAX_PROCESSED_EVENTS = 5_000;
const PROCESSED_EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

const preferenceSchema = z.object({
  accountId: z.string().regex(accountIdPattern),
  email: z.string().email().nullable(),
  telegramChatId: z.string().regex(telegramChatIdPattern).nullable(),
  updatedAt: z.string().datetime(),
});

const sessionSchema = z.object({
  accountId: z.string().regex(accountIdPattern),
  expiresAt: z.string().datetime(),
});

const storeSchema = z.object({
  version: z.literal(1),
  preferences: z.record(z.string(), preferenceSchema),
  sessions: z.record(z.string(), sessionSchema),
  processedEvents: z.record(z.string(), z.string().datetime()),
});

export interface NotificationPreference {
  accountId: string;
  email: string | null;
  telegramChatId: string | null;
  updatedAt: string;
}

interface StoreData {
  version: 1;
  preferences: Record<string, NotificationPreference>;
  sessions: Record<string, { accountId: string; expiresAt: string }>;
  processedEvents: Record<string, string>;
}

function emptyStore(): StoreData {
  return {
    version: 1,
    preferences: {},
    sessions: {},
    processedEvents: {},
  };
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class NotificationPreferenceStore {
  readonly #filePath: string;
  #data: StoreData = emptyStore();
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  async load(): Promise<void> {
    try {
      const parsed = storeSchema.parse(JSON.parse(await readFile(this.#filePath, "utf8")));
      this.#data = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.#data = emptyStore();
      await this.persist();
    }
    await this.prune();
  }

  get(accountId: string): NotificationPreference | null {
    return this.#data.preferences[accountId] ?? null;
  }

  async set(options: {
    accountId: string;
    email: string | null;
    telegramChatId: string | null;
  }): Promise<NotificationPreference> {
    const preference = preferenceSchema.parse({
      ...options,
      updatedAt: new Date().toISOString(),
    });
    this.#data.preferences[options.accountId] = preference;
    await this.persist();
    return preference;
  }

  async issueSession(accountId: string, ttlMs: number): Promise<{
    token: string;
    expiresAt: string;
  }> {
    if (!accountIdPattern.test(accountId)) throw new Error("Invalid NEAR account ID");
    for (const [hash, session] of Object.entries(this.#data.sessions)) {
      if (session.accountId === accountId) delete this.#data.sessions[hash];
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    this.#data.sessions[tokenHash(token)] = { accountId, expiresAt };
    await this.persist();
    return { token, expiresAt };
  }

  async revokeSessions(accountId: string): Promise<void> {
    for (const [hash, session] of Object.entries(this.#data.sessions)) {
      if (session.accountId === accountId) delete this.#data.sessions[hash];
    }
    await this.persist();
  }

  authenticateSession(token: string): string | null {
    if (token.length < 32 || token.length > 128) return null;
    const hash = tokenHash(token);
    const session = this.#data.sessions[hash];
    if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;

    return session.accountId;
  }

  hasProcessedEvent(eventId: string): boolean {
    return Boolean(this.#data.processedEvents[eventId]);
  }

  async markEventProcessed(eventId: string): Promise<void> {
    this.#data.processedEvents[eventId] = new Date().toISOString();
    await this.prune();
    await this.persist();
  }

  private async prune(): Promise<void> {
    const now = Date.now();
    for (const [hash, session] of Object.entries(this.#data.sessions)) {
      if (Date.parse(session.expiresAt) <= now) delete this.#data.sessions[hash];
    }

    const events = Object.entries(this.#data.processedEvents)
      .filter(([, timestamp]) => now - Date.parse(timestamp) <= PROCESSED_EVENT_TTL_MS)
      .sort((left, right) => Date.parse(right[1]) - Date.parse(left[1]))
      .slice(0, MAX_PROCESSED_EVENTS);
    this.#data.processedEvents = Object.fromEntries(events);
  }

  private async persist(): Promise<void> {
    const snapshot = JSON.stringify(this.#data, null, 2) + "\n";
    const directory = path.dirname(this.#filePath);
    const temporaryPath = `${this.#filePath}.${process.pid}.tmp`;
    const write = this.#writeQueue.then(async () => {
      await mkdir(directory, { recursive: true });
      await writeFile(temporaryPath, snapshot, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, this.#filePath);
    });
    this.#writeQueue = write.catch(() => undefined);
    await write;
  }
}

export const notificationPreferenceValidation = {
  accountIdPattern,
  telegramChatIdPattern,
};
