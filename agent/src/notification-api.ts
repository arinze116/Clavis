import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { z } from "zod";

import { errorMessage, logger } from "./logger.js";
import {
  type NotificationAuthorization,
  verifyNotificationAuthorization,
} from "./notification-auth.js";
import {
  notificationPreferenceValidation,
  type NotificationPreferenceStore,
} from "./notification-preferences.js";
import { NearRpcClient } from "./near.js";
import type { NotificationManager } from "./notifications/index.js";

const MAX_BODY_BYTES = 32 * 1_024;
const MAX_EVENTS_PER_WINDOW = 30;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;

const authorizationSchema = z.object({
  accountId: z.string().regex(notificationPreferenceValidation.accountIdPattern),
  action: z.literal("save_preferences"),
  issuedAt: z.string().datetime(),
  nonce: z.string().min(40).max(64),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  message: z.string().min(20).max(2_000),
  recipient: z.string().min(2).max(64),
  callbackUrl: z.string().url(),
  publicKey: z.string().regex(/^(ed25519|secp256k1):/),
  signature: z.string().min(40).max(256),
});

const preferencesPayloadSchema = z.object({
  email: z.string().trim().email().max(254).nullable(),
  telegramChatId: z
    .string()
    .trim()
    .regex(notificationPreferenceValidation.telegramChatIdPattern)
    .nullable(),
});

const savePreferencesSchema = z.object({
  action: z.literal("save_preferences"),
  payload: preferencesPayloadSchema,
  authorization: authorizationSchema,
});

const transactionEventSchema = z.object({
  action: z.literal("transaction_event"),
  sessionToken: z.string().min(32).max(128),
  payload: z.object({
    transactionHash: z.string().trim().min(20).max(100),
    receiverId: z
      .string()
      .regex(notificationPreferenceValidation.accountIdPattern)
      .optional(),
  }),
});

type NotificationRequest =
  | z.infer<typeof savePreferencesSchema>
  | z.infer<typeof transactionEventSchema>;

export interface TransactionResult {
  status: { Failure?: unknown; SuccessValue?: string; SuccessReceiptId?: string };
  transaction: {
    hash: string;
    signer_id: string;
    receiver_id: string;
    actions: Array<{
      FunctionCall?: {
        method_name: string;
        args: string;
      };
    }>;
  };
}

export interface TransactionSummary {
  label: string;
  methodNames: string[];
  details: string[];
  succeeded: boolean;
}

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class NotificationApiServer {
  readonly #host: string;
  readonly #port: number;
  readonly #apiKey: string;
  readonly #factoryContractId: string;
  readonly #allowedOrigins: ReadonlySet<string>;
  readonly #sessionTtlMs: number;
  readonly #store: NotificationPreferenceStore;
  readonly #notifications: NotificationManager;
  readonly #rpc: NearRpcClient;
  readonly #rates = new Map<string, number[]>();
  readonly #inFlightEvents = new Set<string>();
  #lastRatePruneAt = 0;
  #server: Server | null = null;

  constructor(options: {
    host: string;
    port: number;
    apiKey: string;
    factoryContractId: string;
    nearRpcUrl: string;
    allowedOrigins: ReadonlySet<string>;
    sessionTtlMs: number;
    store: NotificationPreferenceStore;
    notifications: NotificationManager;
  }) {
    this.#host = options.host;
    this.#port = options.port;
    this.#apiKey = options.apiKey;
    this.#factoryContractId = options.factoryContractId;
    this.#allowedOrigins = options.allowedOrigins;
    this.#sessionTtlMs = options.sessionTtlMs;
    this.#store = options.store;
    this.#notifications = options.notifications;
    this.#rpc = new NearRpcClient(options.nearRpcUrl);
  }

  async start(): Promise<void> {
    if (this.#server) return;
    const server = createServer((request, response) => {
      void this.handle(request, response);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.#port, this.#host, () => {
        server.off("error", reject);
        resolve();
      });
    });
    this.#server = server;
    logger.info("notification_api.started", { host: this.#host, port: this.#port });
  }

  async stop(): Promise<void> {
    const server = this.#server;
    this.#server = null;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (request.method === "GET" && request.url === "/health") {
        return sendJson(response, 200, { ok: true });
      }
      if (request.method !== "POST" || request.url !== "/v1/notifications") {
        throw new HttpError(404, "Not found");
      }
      if (!secureEqual(bearerToken(request), this.#apiKey)) {
        throw new HttpError(401, "Unauthorized");
      }

      const value = JSON.parse(await readBody(request)) as unknown;
      const action =
        typeof value === "object" && value !== null && "action" in value
          ? (value as { action?: unknown }).action
          : undefined;
      let result: unknown;
      if (action === "save_preferences") {
        result = await this.savePreferences(savePreferencesSchema.parse(value));
      } else if (action === "transaction_event") {
        result = await this.transactionEvent(transactionEventSchema.parse(value));
      } else {
        throw new HttpError(400, "Unsupported notification action");
      }
      sendJson(response, 200, result);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 400;
      logger.warn("notification_api.request_failed", {
        status,
        error: errorMessage(error),
      });
      sendJson(response, status, {
        error: error instanceof Error ? error.message : "Notification request failed",
      });
    }
  }

  private async savePreferences(request: z.infer<typeof savePreferencesSchema>): Promise<unknown> {
    const authorizationId = `auth:${request.authorization.accountId}:${request.authorization.nonce}`;
    if (this.#store.hasProcessedEvent(authorizationId)) {
      throw new HttpError(409, "Notification authorization was already used");
    }
    if (this.#inFlightEvents.has(authorizationId)) {
      throw new HttpError(409, "Notification authorization is processing");
    }
    this.#inFlightEvents.add(authorizationId);
    try {
      await verifyNotificationAuthorization({
        authorization: request.authorization as NotificationAuthorization,
        action: request.action,
        payload: request.payload,
        expectedRecipient: this.#factoryContractId,
        allowedOrigins: this.#allowedOrigins,
        rpc: this.#rpc,
      });
      this.enforceRateLimit(request.authorization.accountId);
      const candidate = {
        accountId: request.authorization.accountId,
        email: request.payload.email,
        telegramChatId: request.payload.telegramChatId,
        updatedAt: new Date().toISOString(),
      };
      const linked = Boolean(candidate.email || candidate.telegramChatId);
      if (linked) await this.#notifications.verifyPreference({ preference: candidate });
      const preference = await this.#store.set({
        accountId: request.authorization.accountId,
        email: request.payload.email,
        telegramChatId: request.payload.telegramChatId,
      });
      await this.#store.revokeSessions(preference.accountId);
      const session = linked
        ? await this.#store.issueSession(preference.accountId, this.#sessionTtlMs)
        : null;
      await this.#store.markEventProcessed(authorizationId);
      return {
        preference,
        sessionToken: session?.token ?? null,
        sessionExpiresAt: session?.expiresAt ?? null,
      };
    } finally {
      this.#inFlightEvents.delete(authorizationId);
    }
  }

  private async transactionEvent(
    request: z.infer<typeof transactionEventSchema>,
  ): Promise<unknown> {
    const accountId = this.#store.authenticateSession(request.sessionToken);
    if (!accountId) throw new HttpError(401, "Notification session is invalid or expired");
    this.enforceRateLimit(accountId);

    const eventId = `${accountId}:${request.payload.transactionHash}`;
    if (this.#store.hasProcessedEvent(eventId)) return { duplicate: true };
    if (this.#inFlightEvents.has(eventId)) throw new HttpError(409, "Notification is processing");
    this.#inFlightEvents.add(eventId);
    try {
      const transaction = await this.#rpc.jsonRpc<TransactionResult>("tx", {
        tx_hash: request.payload.transactionHash,
        sender_account_id: accountId,
        wait_until: "FINAL",
      });
      if (
        transaction.transaction.hash !== request.payload.transactionHash ||
        transaction.transaction.signer_id !== accountId ||
        (request.payload.receiverId &&
          transaction.transaction.receiver_id !== request.payload.receiverId)
      ) {
        throw new HttpError(403, "Transaction does not belong to the linked wallet");
      }
      const summary = summarizeTransaction(transaction);
      await this.#notifications.transactionRecorded({
        accountId,
        receiverId: transaction.transaction.receiver_id,
        transactionHash: transaction.transaction.hash,
        ...summary,
      });
      await this.#store.markEventProcessed(eventId);
      return { duplicate: false, summary };
    } finally {
      this.#inFlightEvents.delete(eventId);
    }
  }

  private enforceRateLimit(accountId: string): void {
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    if (now - this.#lastRatePruneAt >= RATE_LIMIT_WINDOW_MS) {
      for (const [key, values] of this.#rates) {
        const active = values.filter((value) => value > cutoff);
        if (active.length > 0) this.#rates.set(key, active);
        else this.#rates.delete(key);
      }
      this.#lastRatePruneAt = now;
    }
    const recent = (this.#rates.get(accountId) ?? []).filter((value) => value > cutoff);
    if (recent.length >= MAX_EVENTS_PER_WINDOW) {
      throw new HttpError(429, "Too many notification events; try again later");
    }
    recent.push(now);
    this.#rates.set(accountId, recent);
  }
}

export function summarizeTransaction(result: TransactionResult): TransactionSummary {
  const calls = result.transaction.actions.flatMap((action) => {
    if (!action.FunctionCall) return [];
    return [
      {
        methodName: action.FunctionCall.method_name,
        args: decodeArgs(action.FunctionCall.args),
      },
    ];
  });
  const methodNames = calls.map((call) => call.methodName);
  const workerNames = calls
    .filter((call) => call.methodName === "add_recipient")
    .map((call) => {
      const config = call.args.config;
      return typeof config === "object" && config !== null && "name" in config
        ? String((config as { name?: unknown }).name ?? "Worker")
        : "Worker";
    });
  const primaryMethod = methodNames[0] ?? "transaction";
  const labels: Record<string, string> = {
    create_payroll: "Payroll contract deployment",
    add_recipient: workerNames.length > 1 ? `${workerNames.length} workers added` : "Worker added",
    remove_recipient: "Worker removed",
    suspend_recipient: "Worker suspended",
    reinstate_recipient: "Worker reinstated",
    update_limits: "Payroll limits updated",
    update_agent: "Payroll agent updated",
    pause: "Payroll paused",
    unpause: "Payroll resumed",
    emergency_withdraw: "Emergency withdrawal",
    dismiss_anomaly: "Anomaly dismissed",
  };
  return {
    label: labels[primaryMethod] ?? primaryMethod.replaceAll("_", " "),
    methodNames,
    details: workerNames,
    succeeded: result.status.Failure === undefined,
  };
}

function decodeArgs(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8")) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function bearerToken(request: IncomingMessage): string {
  const value = request.headers.authorization ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function secureEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
}
