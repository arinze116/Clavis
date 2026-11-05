import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

const accountIdPattern = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const telegramChatIdPattern = /^-?\d{5,20}$/;
const emailSchema = z.string().trim().email().max(254);
const MAX_PROCESSED_EVENTS = 5_000;
const PROCESSED_EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_EMAIL_CODE_ATTEMPTS = 5;

const preferenceSchema = z.object({
  accountId: z.string().regex(accountIdPattern),
  email: emailSchema.nullable(),
  telegramChatId: z.string().regex(telegramChatIdPattern).nullable(),
  updatedAt: z.string().datetime(),
});

const sessionSchema = z.object({
  accountId: z.string().regex(accountIdPattern),
  expiresAt: z.string().datetime(),
});

const emailChallengeSchema = z.object({
  accountId: z.string().regex(accountIdPattern),
  email: emailSchema,
  codeHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.string().datetime(),
  attempts: z.number().int().min(0).max(MAX_EMAIL_CODE_ATTEMPTS),
});

const telegramPairingSchema = z.object({
  accountId: z.string().regex(accountIdPattern),
  startTokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  pollTokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  telegramChatId: z.string().regex(telegramChatIdPattern).nullable(),
});

const storeSchema = z.object({
  version: z.literal(1),
  preferences: z.record(z.string(), preferenceSchema),
  sessions: z.record(z.string(), sessionSchema),
  processedEvents: z.record(z.string(), z.string().datetime()),
  emailChallenges: z.record(z.string(), emailChallengeSchema).default({}),
  telegramPairings: z.record(z.string(), telegramPairingSchema).default({}),
  telegramUpdateOffset: z.number().int().nonnegative().default(0),
});

export interface NotificationPreference {
  accountId: string;
  email: string | null;
  telegramChatId: string | null;
  updatedAt: string;
}

interface EmailChallenge {
  accountId: string;
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
}

interface TelegramPairing {
  accountId: string;
  startTokenHash: string;
  pollTokenHash: string;
  expiresAt: string;
  completedAt: string | null;
  telegramChatId: string | null;
}

interface StoreData {
  version: 1;
  preferences: Record<string, NotificationPreference>;
  sessions: Record<string, { accountId: string; expiresAt: string }>;
  processedEvents: Record<string, string>;
  emailChallenges: Record<string, EmailChallenge>;
  telegramPairings: Record<string, TelegramPairing>;
  telegramUpdateOffset: number;
}

export type TelegramPairingStatus =
  | { status: "PENDING"; accountId: string; expiresAt: string }
  | {
      status: "CONNECTED";
      accountId: string;
      expiresAt: string;
      preference: NotificationPreference;
    };

function emptyStore(): StoreData {
  return {
    version: 1,
    preferences: {},
    sessions: {},
    processedEvents: {},
    emailChallenges: {},
    telegramPairings: {},
    telegramUpdateOffset: 0,
  };
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function equalHash(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
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
    const preference = this.buildPreference(options.accountId, {
      email: options.email,
      telegramChatId: options.telegramChatId,
    });
    this.#data.preferences[options.accountId] = preference;
    await this.persist();
    return preference;
  }

  async clearChannel(
    accountId: string,
    channel: "email" | "telegram" | "all",
  ): Promise<NotificationPreference> {
    const current = this.get(accountId);
    if (channel === "email" || channel === "all") {
      this.removePendingEmailChallenges(accountId);
    }
    if (channel === "telegram" || channel === "all") {
      this.removePendingTelegramPairings(accountId);
    }
    const preference = this.buildPreference(accountId, {
      email: channel === "email" || channel === "all" ? null : (current?.email ?? null),
      telegramChatId:
        channel === "telegram" || channel === "all"
          ? null
          : (current?.telegramChatId ?? null),
    });
    this.#data.preferences[accountId] = preference;
    await this.persist();
    return preference;
  }

  async createEmailChallenge(
    accountId: string,
    email: string,
    ttlMs: number,
  ): Promise<{ challengeId: string; code: string; expiresAt: string }> {
    if (!accountIdPattern.test(accountId)) throw new Error("Invalid NEAR account ID");
    const normalizedEmail = emailSchema.parse(email);
    this.removePendingEmailChallenges(accountId);

    const challengeId = randomBytes(24).toString("base64url");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    this.#data.emailChallenges[tokenHash(challengeId)] = {
      accountId,
      email: normalizedEmail,
      codeHash: tokenHash(`${challengeId}:${code}`),
      expiresAt,
      attempts: 0,
    };
    await this.persist();
    return { challengeId, code, expiresAt };
  }

  async cancelEmailChallenge(challengeId: string): Promise<void> {
    delete this.#data.emailChallenges[tokenHash(challengeId)];
    await this.persist();
  }

  async confirmEmailChallenge(
    challengeId: string,
    code: string,
  ): Promise<NotificationPreference> {
    const challengeKey = tokenHash(challengeId);
    const challenge = this.#data.emailChallenges[challengeKey];
    if (!challenge || Date.parse(challenge.expiresAt) <= Date.now()) {
      if (challenge) {
        delete this.#data.emailChallenges[challengeKey];
        await this.persist();
      }
      throw new Error("Email verification code is invalid or expired");
    }

    const suppliedHash = tokenHash(`${challengeId}:${code}`);
    if (!equalHash(suppliedHash, challenge.codeHash)) {
      challenge.attempts += 1;
      if (challenge.attempts >= MAX_EMAIL_CODE_ATTEMPTS) {
        delete this.#data.emailChallenges[challengeKey];
      }
      await this.persist();
      throw new Error("Email verification code is invalid or expired");
    }

    delete this.#data.emailChallenges[challengeKey];
    const current = this.get(challenge.accountId);
    const preference = this.buildPreference(challenge.accountId, {
      email: challenge.email,
      telegramChatId: current?.telegramChatId ?? null,
    });
    this.#data.preferences[challenge.accountId] = preference;
    await this.persist();
    return preference;
  }

  async createTelegramPairing(
    accountId: string,
    ttlMs: number,
  ): Promise<{
    pairingId: string;
    startToken: string;
    pollToken: string;
    expiresAt: string;
  }> {
    if (!accountIdPattern.test(accountId)) throw new Error("Invalid NEAR account ID");
    this.removePendingTelegramPairings(accountId);

    const pairingId = randomBytes(18).toString("base64url");
    const startToken = randomBytes(24).toString("base64url");
    const pollToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    this.#data.telegramPairings[tokenHash(pairingId)] = {
      accountId,
      startTokenHash: tokenHash(startToken),
      pollTokenHash: tokenHash(pollToken),
      expiresAt,
      completedAt: null,
      telegramChatId: null,
    };
    await this.persist();
    return { pairingId, startToken, pollToken, expiresAt };
  }

  async completeTelegramPairing(
    startToken: string,
    telegramChatId: string,
  ): Promise<{ preference: NotificationPreference; newlyConnected: boolean } | null> {
    const startHash = tokenHash(startToken);
    const pairing = Object.values(this.#data.telegramPairings).find(
      (candidate) => candidate.startTokenHash === startHash,
    );
    if (!pairing || Date.parse(pairing.expiresAt) <= Date.now()) return null;
    if (pairing.completedAt && pairing.telegramChatId) {
      const preference = this.get(pairing.accountId);
      return preference ? { preference, newlyConnected: false } : null;
    }

    const normalizedChatId = z.string().regex(telegramChatIdPattern).parse(telegramChatId);
    pairing.completedAt = new Date().toISOString();
    pairing.telegramChatId = normalizedChatId;
    const current = this.get(pairing.accountId);
    const preference = this.buildPreference(pairing.accountId, {
      email: current?.email ?? null,
      telegramChatId: normalizedChatId,
    });
    this.#data.preferences[pairing.accountId] = preference;
    await this.persist();
    return { preference, newlyConnected: true };
  }

  getTelegramPairingStatus(
    pairingId: string,
    pollToken: string,
  ): TelegramPairingStatus {
    const pairing = this.#data.telegramPairings[tokenHash(pairingId)];
    if (
      !pairing ||
      Date.parse(pairing.expiresAt) <= Date.now() ||
      !equalHash(tokenHash(pollToken), pairing.pollTokenHash)
    ) {
      throw new Error("Telegram connection is invalid or expired");
    }
    if (!pairing.completedAt || !pairing.telegramChatId) {
      return {
        status: "PENDING",
        accountId: pairing.accountId,
        expiresAt: pairing.expiresAt,
      };
    }
    const preference = this.get(pairing.accountId);
    if (!preference) throw new Error("Telegram connection could not be restored");
    return {
      status: "CONNECTED",
      accountId: pairing.accountId,
      expiresAt: pairing.expiresAt,
      preference,
    };
  }

  async cancelTelegramPairing(pairingId: string, pollToken: string): Promise<void> {
    const pairingKey = tokenHash(pairingId);
    const pairing = this.#data.telegramPairings[pairingKey];
    if (!pairing || !equalHash(tokenHash(pollToken), pairing.pollTokenHash)) {
      throw new Error("Telegram connection is invalid or expired");
    }
    delete this.#data.telegramPairings[pairingKey];
    await this.persist();
  }

  getTelegramUpdateOffset(): number {
    return this.#data.telegramUpdateOffset;
  }

  async setTelegramUpdateOffset(offset: number): Promise<void> {
    this.#data.telegramUpdateOffset = z.number().int().nonnegative().parse(offset);
    await this.persist();
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
    const session = this.#data.sessions[tokenHash(token)];
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

  private buildPreference(
    accountId: string,
    channels: { email: string | null; telegramChatId: string | null },
  ): NotificationPreference {
    return preferenceSchema.parse({
      accountId,
      ...channels,
      updatedAt: new Date().toISOString(),
    });
  }

  private removePendingEmailChallenges(accountId: string): void {
    for (const [hash, challenge] of Object.entries(this.#data.emailChallenges)) {
      if (challenge.accountId === accountId) delete this.#data.emailChallenges[hash];
    }
  }

  private removePendingTelegramPairings(accountId: string): void {
    for (const [hash, pairing] of Object.entries(this.#data.telegramPairings)) {
      if (pairing.accountId === accountId) delete this.#data.telegramPairings[hash];
    }
  }

  private async prune(): Promise<void> {
    const now = Date.now();
    for (const [hash, session] of Object.entries(this.#data.sessions)) {
      if (Date.parse(session.expiresAt) <= now) delete this.#data.sessions[hash];
    }
    for (const [hash, challenge] of Object.entries(this.#data.emailChallenges)) {
      if (Date.parse(challenge.expiresAt) <= now) delete this.#data.emailChallenges[hash];
    }
    for (const [hash, pairing] of Object.entries(this.#data.telegramPairings)) {
      if (Date.parse(pairing.expiresAt) <= now) delete this.#data.telegramPairings[hash];
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
  emailSchema,
  telegramChatIdPattern,
};
