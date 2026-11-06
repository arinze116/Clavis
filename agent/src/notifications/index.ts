import { errorMessage, logger } from "../logger.js";
import type {
  Anomaly,
  BusinessPayroll,
  ContractAnomalyEntry,
  DailyReportSummary,
} from "../types.js";
import type { NotificationPreferenceStore } from "../notification-preferences.js";
import { EmailNotifier } from "./email.js";
import { TelegramNotifier } from "./telegram.js";

interface Audience {
  accountId?: string;
  fallbackEmail?: string;
  fallbackTelegramChatId?: string;
  allowDefaultTelegram?: boolean;
}

interface Destination {
  accountId?: string;
  emailTo?: string;
  telegramChatId?: string;
  allowDefaultTelegram: boolean;
}

export class NotificationManager {
  readonly #email: EmailNotifier;
  readonly #telegram: TelegramNotifier;
  readonly #preferences: NotificationPreferenceStore | undefined;

  constructor(options: {
    resendApiKey: string | undefined;
    resendFromEmail: string;
    telegramBotToken: string | undefined;
    telegramChatId: string | undefined;
    preferences?: NotificationPreferenceStore;
  }) {
    this.#email = new EmailNotifier({
      apiKey: options.resendApiKey,
      from: options.resendFromEmail,
    });
    this.#telegram = new TelegramNotifier({
      botToken: options.telegramBotToken,
      defaultChatId: options.telegramChatId,
    });
    this.#preferences = options.preferences;
  }

  async paymentApproved(options: {
    business: BusinessPayroll;
    ownerAccountId?: string;
    workerAccountId?: string;
    paymentId: number;
    workerName: string;
  }): Promise<void> {
    const payment = formatPaymentId(options.paymentId);
    await this.sendNotification({
      contractId: options.business.contract_id,
      audience: ownerAndWorkerAudience(options),
      subject: `Payment #${payment} approved for ${options.workerName}`,
      emailText:
        `Payment #${payment} was approved for ${options.workerName} on ` +
        `${options.business.contract_id} (NEAR testnet).`,
      telegramText:
        `✅ Payment #${payment} approved · ${options.workerName} · NEAR testnet`,
    });
  }

  async paymentRejected(options: {
    business: BusinessPayroll;
    ownerAccountId?: string;
    workerAccountId?: string;
    paymentId: number;
    reason: string;
  }): Promise<void> {
    const payment = formatPaymentId(options.paymentId);
    await this.sendNotification({
      contractId: options.business.contract_id,
      audience: ownerAndWorkerAudience(options),
      subject: `Payment #${payment} rejected: ${options.reason}`,
      emailText:
        `Payment #${payment} was rejected by ${options.business.contract_id}. ` +
        `Reason: ${options.reason}`,
      telegramText:
        `❌ Payment rejected · ${options.reason} · ${options.business.contract_id}`,
    });
  }

  async contractDecisionDetected(options: {
    business: BusinessPayroll;
    ownerAccountId?: string;
    paymentId: number;
    approved: boolean;
    reason?: string;
  }): Promise<void> {
    const payment = formatPaymentId(options.paymentId);
    const status = options.approved ? "approved" : "rejected";
    const reason = options.reason ? ` Reason: ${options.reason}` : "";
    await this.sendNotification({
      contractId: options.business.contract_id,
      audience: [ownerAudience(options.business, options.ownerAccountId)],
      subject: `Payment #${payment} ${status} on ${options.business.contract_id}`,
      emailText:
        `Payment #${payment} was ${status} by ${options.business.contract_id}.` + reason,
      telegramText:
        `${options.approved ? "✅" : "❌"} Payment #${payment} ${status}` +
        `${options.reason ? ` · ${options.reason}` : ""} · ${options.business.contract_id}`,
    });
  }

  async contractAnomalyDetected(options: {
    business: BusinessPayroll;
    ownerAccountId?: string;
    anomaly: ContractAnomalyEntry;
  }): Promise<void> {
    const milliseconds = BigInt(String(options.anomaly.timestamp)) / 1_000_000n;
    const time = new Date(Number(milliseconds)).toISOString().slice(11, 16);
    await this.sendNotification({
      contractId: options.business.contract_id,
      audience: [ownerAudience(options.business, options.ownerAccountId)],
      subject: `Anomaly alert: ${options.anomaly.anomaly_type}`,
      emailText:
        `Clavis detected a ${options.anomaly.severity} ${options.anomaly.anomaly_type} anomaly ` +
        `on ${options.business.contract_id}. ${options.anomaly.description}`,
      telegramText:
        `⚠️ ${options.anomaly.severity} anomaly: ${options.anomaly.anomaly_type} · ` +
        `${options.anomaly.description} · ${time} UTC`,
    });
  }

  async recipientAdded(options: {
    contractId: string;
    workerAccountId: string;
    workerName: string;
  }): Promise<void> {
    await this.sendNotification({
      contractId: options.contractId,
      audience: [{ accountId: options.workerAccountId }],
      subject: `You were added to ${options.contractId} payroll`,
      emailText:
        `${options.workerName}, your NEAR testnet wallet was added to the payroll roster for ` +
        `${options.contractId}. Open https://clavisapp.vercel.app/worker with the same wallet ` +
        "to review your schedule and privacy-minimized payment history.",
      telegramText:
        `✅ Added to payroll · ${options.workerName} · ${options.contractId}`,
    });
  }

  async anomalyDetected(options: {
    business: BusinessPayroll;
    ownerAccountId?: string;
    anomaly: Anomaly;
  }): Promise<void> {
    const time = new Date(options.anomaly.timestamp).toISOString().slice(11, 16);
    await this.sendNotification({
      contractId: options.business.contract_id,
      audience: [ownerAudience(options.business, options.ownerAccountId)],
      subject: `Anomaly alert: ${options.anomaly.type} — ${options.anomaly.description}`,
      emailText:
        `Clavis detected ${options.anomaly.type} on ${options.business.contract_id}. ` +
        options.anomaly.description,
      telegramText:
        `⚠️ Anomaly: ${options.anomaly.type} · ${options.anomaly.description} · ${time} UTC`,
    });
  }

  async dailyReport(options: {
    business: BusinessPayroll;
    ownerAccountId?: string;
    reportDate: string;
    summary: DailyReportSummary;
  }): Promise<void> {
    const { summary } = options;
    await this.sendNotification({
      contractId: options.business.contract_id,
      audience: [ownerAudience(options.business, options.ownerAccountId)],
      subject: `Clavis daily report · ${options.reportDate}`,
      emailText: [
        `Daily payroll report for ${options.business.contract_id}`,
        `Approved: ${summary.approvedPayments}`,
        `Delivered: ${summary.deliveredPayments}`,
        `Delivery failures: ${summary.deliveryFailures}`,
        `Authorized amount (yoctoNEAR): ${summary.authorizedAmountYocto}`,
      ].join("\n"),
      telegramText:
        `📊 Daily report · ${summary.approvedPayments} approved · ` +
        `${summary.deliveredPayments} delivered · ${summary.deliveryFailures} failed`,
    });
  }

  async deliverySubmitted(options: DeliveryOptions & {
    fallback: boolean;
    settlementKind: "solver_intent" | "native_near";
  }): Promise<void> {
    await this.sendNotification({
      contractId: options.business.contract_id,
      audience: ownerAndWorkerAudience(options),
      subject: `Payment #${formatPaymentId(options.paymentId)} delivery submitted`,
      emailText:
        `Delivery for ${options.workerName} was submitted on ${options.business.contract_id}. ` +
        `Route: ${options.chain}/${options.token}.` +
        (options.settlementKind === "native_near"
          ? " Settlement: direct native NEAR."
          : " Settlement: NEAR Intents solver submission."),
      telegramText:
        `🚚 Delivery submitted · ${options.workerName} · ${options.chain}/${options.token}`,
    });
  }

  async deliveryFilled(options: DeliveryOptions & { transactionHash?: string }): Promise<void> {
    await this.sendNotification({
      contractId: options.business.contract_id,
      audience: ownerAndWorkerAudience(options),
      subject: `Payment #${formatPaymentId(options.paymentId)} delivered`,
      emailText:
        `Payment delivery for ${options.workerName} is filled on ` +
        `${options.chain}/${options.token}.` +
        (options.transactionHash ? ` Transaction: ${options.transactionHash}` : ""),
      telegramText:
        `✅ Delivery filled · ${options.workerName} · ${options.chain}/${options.token}`,
    });
  }

  async deliveryFailed(options: DeliveryOptions & { reason: string }): Promise<void> {
    await this.sendNotification({
      contractId: options.business.contract_id,
      audience: ownerAndWorkerAudience(options),
      subject: `Payment #${formatPaymentId(options.paymentId)} delivery failed`,
      emailText:
        `Payment delivery for ${options.workerName} failed on ` +
        `${options.chain}/${options.token}. Reason: ${options.reason}`,
      telegramText:
        `❌ Delivery failed · ${options.workerName} · ${options.reason}`,
    });
  }

  async sendEmailVerification(options: {
    accountId: string;
    email: string;
    code: string;
  }): Promise<void> {
    const result = await this.#email.send({
      to: options.email,
      subject: `${options.code} is your Clavis verification code`,
      text: [
        `Enter ${options.code} in Clavis to link email notifications to ${options.accountId}.`,
        "This code expires in 10 minutes.",
        "If you did not request this, you can ignore this email.",
      ].join("\n\n"),
    });
    if (result === "skipped") {
      throw new Error("Email notifications are not configured by the Clavis operator");
    }
  }

  async transactionRecorded(options: {
    accountId: string;
    receiverId: string;
    transactionHash: string;
    label: string;
    methodNames: string[];
    details: string[];
    succeeded: boolean;
  }): Promise<void> {
    const status = options.succeeded ? "confirmed" : "failed";
    const detail = options.details.length > 0 ? ` · ${options.details.join(", ")}` : "";
    await this.sendNotification({
      contractId: options.receiverId,
      audience: [{ accountId: options.accountId }],
      subject: `${options.label} ${status} on NEAR testnet`,
      emailText: [
        `${options.label} ${status} for ${options.accountId}.`,
        `Contract: ${options.receiverId}`,
        `Methods: ${options.methodNames.join(", ") || "transaction"}`,
        `Transaction: ${options.transactionHash}`,
        `Explorer: https://testnet.nearblocks.io/txns/${options.transactionHash}`,
      ].join("\n"),
      telegramText:
        `${options.succeeded ? "✅" : "❌"} ${options.label} ${status}` +
        `${detail} · ${options.receiverId}`,
    });
  }

  private async sendNotification(options: {
    contractId: string;
    audience: Audience[];
    subject: string;
    emailText: string;
    telegramText: string;
  }): Promise<void> {
    const destinations = dedupeDestinations(
      options.audience.map((audience) => this.resolveDestination(audience)),
    );
    await Promise.all(
      destinations.map((destination) =>
        this.sendBoth({
          contractId: options.contractId,
          destination,
          subject: options.subject,
          emailText: options.emailText,
          telegramText: options.telegramText,
        }),
      ),
    );
  }

  private resolveDestination(audience: Audience): Destination {
    const linked = audience.accountId
      ? this.#preferences?.get(audience.accountId)
      : null;
    if (linked) {
      return {
        ...(audience.accountId ? { accountId: audience.accountId } : {}),
        ...(linked.email ? { emailTo: linked.email } : {}),
        ...(linked.telegramChatId ? { telegramChatId: linked.telegramChatId } : {}),
        allowDefaultTelegram: false,
      };
    }
    return {
      ...(audience.accountId ? { accountId: audience.accountId } : {}),
      ...(audience.fallbackEmail ? { emailTo: audience.fallbackEmail } : {}),
      ...(audience.fallbackTelegramChatId
        ? { telegramChatId: audience.fallbackTelegramChatId }
        : {}),
      allowDefaultTelegram: audience.allowDefaultTelegram ?? false,
    };
  }

  private async sendBoth(options: {
    contractId: string;
    destination: Destination;
    subject: string;
    emailText: string;
    telegramText: string;
  }): Promise<void> {
    const [email, telegram] = await Promise.allSettled([
      this.#email.send({
        to: options.destination.emailTo,
        subject: options.subject,
        text: options.emailText,
      }),
      this.#telegram.send(
        options.telegramText,
        options.destination.telegramChatId,
        options.destination.allowDefaultTelegram,
      ),
    ]);

    for (const [channel, result] of [
      ["email", email],
      ["telegram", telegram],
    ] as const) {
      if (result.status === "rejected") {
        logger.error("notification.failed", {
          contractId: options.contractId,
          accountId: options.destination.accountId,
          channel,
          error: errorMessage(result.reason),
        });
      } else if (result.value === "skipped") {
        logger.warn("notification.skipped", {
          contractId: options.contractId,
          accountId: options.destination.accountId,
          channel,
        });
      }
    }
  }
}

interface DeliveryOptions {
  business: BusinessPayroll;
  ownerAccountId?: string;
  workerAccountId?: string;
  paymentId: number;
  workerName: string;
  chain: string;
  token: string;
}

function ownerAudience(business: BusinessPayroll, accountId: string | undefined): Audience {
  const fallbackEmail =
    business.owner_email === "notifications-disabled@example.com"
      ? undefined
      : business.owner_email;
  return {
    ...(accountId ? { accountId } : {}),
    ...(fallbackEmail ? { fallbackEmail } : {}),
    ...(business.telegram_chat_id
      ? { fallbackTelegramChatId: business.telegram_chat_id }
      : {}),
    allowDefaultTelegram: true,
  };
}

function ownerAndWorkerAudience(options: {
  business: BusinessPayroll;
  ownerAccountId?: string;
  workerAccountId?: string;
}): Audience[] {
  const audience = [ownerAudience(options.business, options.ownerAccountId)];
  if (options.workerAccountId && options.workerAccountId !== options.ownerAccountId) {
    audience.push({ accountId: options.workerAccountId });
  }
  return audience;
}

function dedupeDestinations(destinations: Destination[]): Destination[] {
  const seen = new Set<string>();
  return destinations.filter((destination) => {
    const key = [
      destination.emailTo ?? "",
      destination.telegramChatId ?? "",
      String(destination.allowDefaultTelegram),
    ].join("|");
    if (
      (!destination.emailTo &&
        !destination.telegramChatId &&
        !destination.allowDefaultTelegram) ||
      seen.has(key)
    ) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatPaymentId(paymentId: number): string {
  return String(paymentId).padStart(3, "0");
}
