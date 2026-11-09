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
  type NotificationPreference,
  type NotificationPreferenceStore,
} from "./notification-preferences.js";
import { payrollRecipientSchema } from "./payroll.js";
import {
  PayrollPlanStore,
  type ExpectedRecipientPolicy,
  type PendingPayrollOperation,
} from "./payroll-plan-store.js";
import { NearRpcClient } from "./near.js";
import type { NotificationManager } from "./notifications/index.js";
import type { PayrollRecipient, RecipientView } from "./types.js";

const MAX_BODY_BYTES = 48 * 1_024;
const MAX_EVENTS_PER_WINDOW = 30;
const MAX_LINK_CHANGES_PER_WINDOW = 10;
const MAX_PAYROLL_CHANGES_PER_WINDOW = 30;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;
const EMAIL_CHALLENGE_TTL_MS = 10 * 60 * 1_000;
const TELEGRAM_PAIRING_TTL_MS = 10 * 60 * 1_000;
const PAYROLL_RECONCILIATION_INTERVAL_MS = 30_000;

const signedActionSchema = z.enum([
  "begin_email_link",
  "begin_telegram_link",
  "unlink_notification_channel",
  "sync_payroll_plan",
  "upsert_payroll_recipient",
  "remove_payroll_recipient",
]);

const authorizationSchema = z.object({
  accountId: z.string().regex(notificationPreferenceValidation.accountIdPattern),
  action: signedActionSchema,
  issuedAt: z.string().datetime(),
  nonce: z.string().min(40).max(64),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  message: z.string().min(20).max(2_000),
  origin: z.string().url().max(2_048).optional(),
  recipient: z.string().min(2).max(64),
  callbackUrl: z.string().url().max(2_048).optional(),
  publicKey: z.string().regex(/^(ed25519|secp256k1):/),
  signature: z.string().min(40).max(256),
});

const beginEmailLinkSchema = z.object({
  action: z.literal("begin_email_link"),
  payload: z.object({
    email: notificationPreferenceValidation.emailSchema,
  }),
  authorization: authorizationSchema,
});

const confirmEmailLinkSchema = z.object({
  action: z.literal("confirm_email_link"),
  payload: z.object({
    challengeId: z.string().min(20).max(100),
    code: z.string().regex(/^\d{6}$/),
  }),
});

const beginTelegramLinkSchema = z.object({
  action: z.literal("begin_telegram_link"),
  payload: z.object({}).strict(),
  authorization: authorizationSchema,
});

const telegramLinkStatusSchema = z.object({
  action: z.literal("telegram_link_status"),
  payload: z.object({
    pairingId: z.string().min(20).max(100),
    pollToken: z.string().min(32).max(128),
  }),
});

const cancelTelegramLinkSchema = z.object({
  action: z.literal("cancel_telegram_link"),
  payload: z.object({
    pairingId: z.string().min(20).max(100),
    pollToken: z.string().min(32).max(128),
  }),
});

const unlinkChannelSchema = z.object({
  action: z.literal("unlink_notification_channel"),
  payload: z.object({
    channel: z.enum(["email", "telegram", "all"]),
  }),
  authorization: authorizationSchema,
});

const payrollContractIdSchema = z
  .string()
  .trim()
  .regex(notificationPreferenceValidation.accountIdPattern)
  .refine(
    (value) => value === "clavis.testnet" || value.endsWith(".clavis.testnet"),
    "Payroll contract must be managed by clavis.testnet",
  );

const expectedRecipientPolicySchema = z.object({
  name: z.string().trim().min(1).max(80),
  personalCapYocto: z.string().regex(/^\d+$/),
  active: z.boolean(),
  preferredChain: z.enum(["near", "ethereum", "bnb"]),
  preferredToken: z.enum(["NEAR", "USDC", "BUSD"]),
  paymentSplit: z
    .array(
      z.object({
        chain: z.enum(["near", "ethereum", "bnb"]),
        token: z.enum(["NEAR", "USDC", "BUSD"]),
        percentage: z.number().int().min(1).max(100),
      }),
    )
    .max(3),
  schedule: z.enum(["Weekly", "Biweekly", "Milestone"]),
});

const syncPayrollPlanSchema = z.object({
  action: z.literal("sync_payroll_plan"),
  payload: z.object({
    contractId: payrollContractIdSchema,
    entries: z
      .array(
        z.object({
          recipient: payrollRecipientSchema,
          expectedPolicy: expectedRecipientPolicySchema,
        }),
      )
      .max(20),
  }),
  authorization: authorizationSchema,
});

const upsertPayrollRecipientSchema = z.object({
  action: z.literal("upsert_payroll_recipient"),
  payload: z.object({
    contractId: payrollContractIdSchema,
    recipient: payrollRecipientSchema,
    expectedPolicy: expectedRecipientPolicySchema,
  }),
  authorization: authorizationSchema,
});

const removePayrollRecipientSchema = z.object({
  action: z.literal("remove_payroll_recipient"),
  payload: z.object({
    contractId: payrollContractIdSchema,
    recipientHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  authorization: authorizationSchema,
});

const reconcilePayrollOperationSchema = z.object({
  action: z.literal("reconcile_payroll_operation"),
  sessionToken: z.string().min(32).max(128),
  payload: z.object({
    operationId: z.string().uuid(),
  }),
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

interface SignedRequest {
  action: z.infer<typeof signedActionSchema>;
  payload: unknown;
  authorization: z.infer<typeof authorizationSchema>;
}

interface PreferenceResponse {
  preference: NotificationPreference;
  sessionToken: string | null;
  sessionExpiresAt: string | null;
}

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
  readonly #payrollPlans: PayrollPlanStore;
  readonly #notifications: NotificationManager;
  readonly #rpc: NearRpcClient;
  readonly #telegramBotUsername: string | undefined;
  readonly #rates = new Map<string, number[]>();
  readonly #inFlightEvents = new Set<string>();
  #lastRatePruneAt = 0;
  #server: Server | null = null;
  #reconciliationTimer: ReturnType<typeof setInterval> | null = null;
  #reconciliationInFlight: Promise<void> | null = null;

  constructor(options: {
    host: string;
    port: number;
    apiKey: string;
    factoryContractId: string;
    nearRpcUrl: string;
    allowedOrigins: ReadonlySet<string>;
    sessionTtlMs: number;
    payrollDirectory: string;
    store: NotificationPreferenceStore;
    notifications: NotificationManager;
    telegramBotUsername?: string;
  }) {
    this.#host = options.host;
    this.#port = options.port;
    this.#apiKey = options.apiKey;
    this.#factoryContractId = options.factoryContractId;
    this.#allowedOrigins = options.allowedOrigins;
    this.#sessionTtlMs = options.sessionTtlMs;
    this.#store = options.store;
    this.#payrollPlans = new PayrollPlanStore(options.payrollDirectory);
    this.#notifications = options.notifications;
    this.#rpc = new NearRpcClient(options.nearRpcUrl);
    const username = options.telegramBotUsername?.replace(/^@/, "");
    this.#telegramBotUsername =
      username && /^[A-Za-z0-9_]{5,32}$/.test(username) ? username : undefined;
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
    this.#reconciliationTimer = setInterval(() => {
      void this.reconcilePendingPayrollOperations().catch((error) => {
        logger.error("payroll_plan.reconciliation_failed", { error: errorMessage(error) });
      });
    }, PAYROLL_RECONCILIATION_INTERVAL_MS);
    void this.reconcilePendingPayrollOperations().catch((error) => {
      logger.error("payroll_plan.reconciliation_failed", { error: errorMessage(error) });
    });
    logger.info("notification_api.started", { host: this.#host, port: this.#port });
  }

  async stop(): Promise<void> {
    if (this.#reconciliationTimer) {
      clearInterval(this.#reconciliationTimer);
      this.#reconciliationTimer = null;
    }
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
      if (action === "begin_email_link") {
        result = await this.beginEmailLink(beginEmailLinkSchema.parse(value));
      } else if (action === "confirm_email_link") {
        result = await this.confirmEmailLink(confirmEmailLinkSchema.parse(value));
      } else if (action === "begin_telegram_link") {
        result = await this.beginTelegramLink(beginTelegramLinkSchema.parse(value));
      } else if (action === "telegram_link_status") {
        result = await this.telegramLinkStatus(telegramLinkStatusSchema.parse(value));
      } else if (action === "cancel_telegram_link") {
        result = await this.cancelTelegramLink(cancelTelegramLinkSchema.parse(value));
      } else if (action === "unlink_notification_channel") {
        result = await this.unlinkChannel(unlinkChannelSchema.parse(value));
      } else if (action === "sync_payroll_plan") {
        result = await this.syncPayrollPlan(syncPayrollPlanSchema.parse(value));
      } else if (action === "upsert_payroll_recipient") {
        result = await this.upsertPayrollRecipient(
          upsertPayrollRecipientSchema.parse(value),
        );
      } else if (action === "remove_payroll_recipient") {
        result = await this.removePayrollRecipient(
          removePayrollRecipientSchema.parse(value),
        );
      } else if (action === "reconcile_payroll_operation") {
        result = await this.reconcilePayrollOperation(
          reconcilePayrollOperationSchema.parse(value),
        );
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

  private async beginEmailLink(
    request: z.infer<typeof beginEmailLinkSchema>,
  ): Promise<unknown> {
    return this.withAuthorization(request, async (accountId) => {
      const challenge = await this.#store.createEmailChallenge(
        accountId,
        request.payload.email,
        EMAIL_CHALLENGE_TTL_MS,
      );
      try {
        await this.#notifications.sendEmailVerification({
          accountId,
          email: request.payload.email,
          code: challenge.code,
        });
      } catch (error) {
        await this.#store.cancelEmailChallenge(challenge.challengeId);
        throw error;
      }
      return {
        challengeId: challenge.challengeId,
        email: request.payload.email,
        expiresAt: challenge.expiresAt,
      };
    });
  }

  private async confirmEmailLink(
    request: z.infer<typeof confirmEmailLinkSchema>,
  ): Promise<unknown> {
    const preference = await this.#store.confirmEmailChallenge(
      request.payload.challengeId,
      request.payload.code,
    );
    this.enforceRateLimit(`link:${preference.accountId}`, MAX_LINK_CHANGES_PER_WINDOW);
    return this.preferenceResponse(preference);
  }

  private async beginTelegramLink(
    request: z.infer<typeof beginTelegramLinkSchema>,
  ): Promise<unknown> {
    if (!this.#telegramBotUsername) {
      throw new HttpError(503, "Telegram linking is not configured by the Clavis operator");
    }
    return this.withAuthorization(request, async (accountId) => {
      const pairing = await this.#store.createTelegramPairing(
        accountId,
        TELEGRAM_PAIRING_TTL_MS,
      );
      return {
        pairingId: pairing.pairingId,
        pollToken: pairing.pollToken,
        expiresAt: pairing.expiresAt,
        connectUrl:
          `https://t.me/${this.#telegramBotUsername}` +
          `?start=${encodeURIComponent(pairing.startToken)}`,
      };
    });
  }

  private async telegramLinkStatus(
    request: z.infer<typeof telegramLinkStatusSchema>,
  ): Promise<unknown> {
    const status = this.#store.getTelegramPairingStatus(
      request.payload.pairingId,
      request.payload.pollToken,
    );
    if (status.status === "PENDING") return status;
    this.enforceRateLimit(`link:${status.accountId}`, MAX_LINK_CHANGES_PER_WINDOW);
    return {
      status: "CONNECTED",
      ...(await this.preferenceResponse(status.preference)),
    };
  }

  private async cancelTelegramLink(
    request: z.infer<typeof cancelTelegramLinkSchema>,
  ): Promise<unknown> {
    await this.#store.cancelTelegramPairing(
      request.payload.pairingId,
      request.payload.pollToken,
    );
    return { cancelled: true };
  }

  private async unlinkChannel(
    request: z.infer<typeof unlinkChannelSchema>,
  ): Promise<unknown> {
    return this.withAuthorization(request, async (accountId) => {
      const preference = await this.#store.clearChannel(
        accountId,
        request.payload.channel,
      );
      return this.preferenceResponse(preference);
    });
  }

  private async syncPayrollPlan(
    request: z.infer<typeof syncPayrollPlanSchema>,
  ): Promise<unknown> {
    return this.withAuthorization(request, async (accountId) => {
      await this.assertPayrollOwner(request.payload.contractId, accountId);
      const preference = this.#store.get(accountId);
      const onChainRecipients = await this.#rpc.view<RecipientView[]>(
        request.payload.contractId,
        "get_recipients",
        { from: 0, limit: 100 },
      );
      if (onChainRecipients.length !== request.payload.entries.length) {
        throw new HttpError(
          409,
          "The private plan must match the complete on-chain recipient roster",
        );
      }
      const onChainByHash = new Map(
        onChainRecipients.map((recipient) => [recipient.recipient_hash, recipient]),
      );
      const recipients: PayrollRecipient[] = [];
      for (const entry of request.payload.entries) {
        const recipient = onChainByHash.get(entry.recipient.recipientHash);
        if (!recipient || !recipientMatchesExpectedPolicy(recipient, entry.expectedPolicy)) {
          throw new HttpError(
            409,
            `On-chain recipient ${entry.recipient.recipientHash} does not match the private plan`,
          );
        }
        recipients.push(entry.recipient as PayrollRecipient);
      }
      const result = await this.#payrollPlans.sync({
        contractId: request.payload.contractId,
        recipients,
        ...(preference?.email ? { ownerEmail: preference.email } : {}),
        ...(preference?.telegramChatId
          ? { telegramChatId: preference.telegramChatId }
          : {}),
      });
      const session = await this.#store.issueSession(accountId, this.#sessionTtlMs);
      return {
        synced: true,
        recipientCount: result.recipientCount,
        sessionToken: session.token,
        sessionExpiresAt: session.expiresAt,
      };
    });
  }

  private async upsertPayrollRecipient(
    request: z.infer<typeof upsertPayrollRecipientSchema>,
  ): Promise<unknown> {
    return this.withAuthorization(request, async (accountId) => {
      await this.assertPayrollOwner(request.payload.contractId, accountId);
      const preference = this.#store.get(accountId);
      const operation = await this.#payrollPlans.prepareUpsert({
        contractId: request.payload.contractId,
        recipient: request.payload.recipient as PayrollRecipient,
        expectedPolicy: request.payload.expectedPolicy,
        ...(preference?.email ? { ownerEmail: preference.email } : {}),
        ...(preference?.telegramChatId
          ? { telegramChatId: preference.telegramChatId }
          : {}),
      });
      const reconciliationStatus = await this.attemptPendingReconciliation(operation);
      const session = await this.#store.issueSession(accountId, this.#sessionTtlMs);
      return {
        staged: true,
        operationId: operation.operationId,
        reconciliationStatus,
        sessionToken: session.token,
        sessionExpiresAt: session.expiresAt,
      };
    });
  }

  private async removePayrollRecipient(
    request: z.infer<typeof removePayrollRecipientSchema>,
  ): Promise<unknown> {
    return this.withAuthorization(request, async (accountId) => {
      await this.assertPayrollOwner(request.payload.contractId, accountId);
      const preference = this.#store.get(accountId);
      const operation = await this.#payrollPlans.prepareRemove({
        contractId: request.payload.contractId,
        recipientHash: request.payload.recipientHash,
        ...(preference?.email ? { ownerEmail: preference.email } : {}),
        ...(preference?.telegramChatId
          ? { telegramChatId: preference.telegramChatId }
          : {}),
      });
      const reconciliationStatus = await this.attemptPendingReconciliation(operation);
      const session = await this.#store.issueSession(accountId, this.#sessionTtlMs);
      return {
        staged: true,
        operationId: operation.operationId,
        reconciliationStatus,
        sessionToken: session.token,
        sessionExpiresAt: session.expiresAt,
      };
    });
  }

  private async reconcilePayrollOperation(
    request: z.infer<typeof reconcilePayrollOperationSchema>,
  ): Promise<unknown> {
    const accountId = this.#store.authenticateSession(request.sessionToken);
    if (!accountId) throw new HttpError(401, "Payroll session is invalid or expired");
    this.enforceRateLimit(`payroll:${accountId}`, MAX_PAYROLL_CHANGES_PER_WINDOW);
    const operation = (await this.#payrollPlans.listPending()).find(
      (item) => item.operationId === request.payload.operationId,
    );
    if (!operation) {
      return {
        operationId: request.payload.operationId,
        reconciliationStatus: "committed",
      };
    }
    await this.assertPayrollOwner(operation.contractId, accountId);
    return {
      operationId: operation.operationId,
      reconciliationStatus: await this.attemptPendingReconciliation(operation),
    };
  }

  private attemptPendingReconciliation(
    operation: PendingPayrollOperation,
  ): Promise<"committed" | "pending"> {
    return this.reconcilePendingOperation(operation).catch((error) => {
      logger.warn("payroll_plan.reconciliation_deferred", {
        operationId: operation.operationId,
        contractId: operation.contractId,
        error: errorMessage(error),
      });
      return "pending" as const;
    });
  }

  private async reconcilePendingOperation(
    operation: PendingPayrollOperation,
  ): Promise<"committed" | "pending"> {
    const recipient = await this.#rpc.view<RecipientView | null>(
      operation.contractId,
      "get_recipient",
      { recipient_hash: operation.recipientHash },
    );
    const canCommit = pendingOperationMatchesRecipient(operation, recipient);
    if (!canCommit) return "pending";
    await this.#payrollPlans.commitPending(operation.operationId);
    logger.info("payroll_plan.reconciled", {
      operationId: operation.operationId,
      contractId: operation.contractId,
      action: operation.action,
    });
    return "committed";
  }

  private reconcilePendingPayrollOperations(): Promise<void> {
    if (this.#reconciliationInFlight) return this.#reconciliationInFlight;
    const reconciliation = (async () => {
      const operations = await this.#payrollPlans.listPending();
      for (const operation of operations) {
        await this.attemptPendingReconciliation(operation);
      }
    })();
    this.#reconciliationInFlight = reconciliation.finally(() => {
      this.#reconciliationInFlight = null;
    });
    return this.#reconciliationInFlight;
  }

  private async assertPayrollOwner(contractId: string, accountId: string): Promise<void> {
    if (!(await isPayrollOwner(this.#rpc, contractId, accountId))) {
      throw new HttpError(403, "Only the payroll contract owner can manage its private plan");
    }
  }

  private async withAuthorization<T>(
    request: SignedRequest,
    work: (accountId: string) => Promise<T>,
  ): Promise<T> {
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
      const accountId = request.authorization.accountId;
      const payrollAction = request.action.includes("payroll");
      this.enforceRateLimit(
        `${payrollAction ? "payroll" : "link"}:${accountId}`,
        payrollAction ? MAX_PAYROLL_CHANGES_PER_WINDOW : MAX_LINK_CHANGES_PER_WINDOW,
      );
      const result = await work(accountId);
      await this.#store.markEventProcessed(authorizationId);
      return result;
    } finally {
      this.#inFlightEvents.delete(authorizationId);
    }
  }

  private async preferenceResponse(
    preference: NotificationPreference,
  ): Promise<PreferenceResponse> {
    await this.#store.revokeSessions(preference.accountId);
    const linked = Boolean(preference.email || preference.telegramChatId);
    const session = linked
      ? await this.#store.issueSession(preference.accountId, this.#sessionTtlMs)
      : null;
    return {
      preference,
      sessionToken: session?.token ?? null,
      sessionExpiresAt: session?.expiresAt ?? null,
    };
  }

  private async transactionEvent(
    request: z.infer<typeof transactionEventSchema>,
  ): Promise<unknown> {
    const accountId = this.#store.authenticateSession(request.sessionToken);
    if (!accountId) throw new HttpError(401, "Notification session is invalid or expired");
    this.enforceRateLimit(`event:${accountId}`, MAX_EVENTS_PER_WINDOW);

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
      if (summary.succeeded) {
        await this.notifyAddedRecipients(transaction);
      }
      await this.#store.markEventProcessed(eventId);
      return { duplicate: false, summary };
    } finally {
      this.#inFlightEvents.delete(eventId);
    }
  }

  private async notifyAddedRecipients(transaction: TransactionResult): Promise<void> {
    const recipientHashes = transaction.transaction.actions.flatMap((action) => {
      if (action.FunctionCall?.method_name !== "add_recipient") return [];
      const hash = decodeArgs(action.FunctionCall.args).recipient_hash;
      return typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash) ? [hash] : [];
    });
    if (recipientHashes.length === 0) return;

    const plan = await this.#payrollPlans.get(transaction.transaction.receiver_id);
    if (!plan) return;
    const recipients = new Map(
      plan.recipients.map((recipient) => [recipient.recipientHash, recipient]),
    );
    for (const recipientHash of new Set(recipientHashes)) {
      const recipient = recipients.get(recipientHash);
      if (!recipient?.nearAddress) continue;
      await this.#notifications.recipientAdded({
        contractId: transaction.transaction.receiver_id,
        workerAccountId: recipient.nearAddress,
        workerName: recipient.name,
      });
    }
  }

  private enforceRateLimit(key: string, maximum: number): void {
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
    const recent = (this.#rates.get(key) ?? []).filter((value) => value > cutoff);
    if (recent.length >= maximum) {
      throw new HttpError(429, "Too many notification requests; try again later");
    }
    recent.push(now);
    this.#rates.set(key, recent);
  }
}

export async function isPayrollOwner(
  rpc: NearRpcClient,
  contractId: string,
  accountId: string,
): Promise<boolean> {
  return (await rpc.view<string>(contractId, "get_owner")) === accountId;
}

export function recipientMatchesExpectedPolicy(
  recipient: RecipientView,
  expected: ExpectedRecipientPolicy,
): boolean {
  const normalizeSplits = (
    splits: Array<{ chain: string; token: string; percentage: number }>,
  ) =>
    [...splits].sort((left, right) =>
      `${left.chain}:${left.token}:${left.percentage}`.localeCompare(
        `${right.chain}:${right.token}:${right.percentage}`,
      ),
    );
  return (
    recipient.name === expected.name &&
    recipient.personal_cap === expected.personalCapYocto &&
    recipient.active === expected.active &&
    recipient.preferred_chain === expected.preferredChain &&
    recipient.preferred_token === expected.preferredToken &&
    recipient.schedule === expected.schedule &&
    JSON.stringify(normalizeSplits(recipient.payment_split)) ===
      JSON.stringify(normalizeSplits(expected.paymentSplit))
  );
}

export function pendingOperationMatchesRecipient(
  operation: PendingPayrollOperation,
  recipient: RecipientView | null,
): boolean {
  return operation.action === "remove"
    ? recipient === null
    : recipient !== null &&
        recipientMatchesExpectedPolicy(recipient, operation.expectedPolicy);
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
