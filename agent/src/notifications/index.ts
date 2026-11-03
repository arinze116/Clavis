import { errorMessage, logger } from "../logger.js";
import type {
  Anomaly,
  BusinessPayroll,
  DailyReportSummary,
} from "../types.js";
import { EmailNotifier } from "./email.js";
import { TelegramNotifier } from "./telegram.js";

export class NotificationManager {
  readonly #email: EmailNotifier;
  readonly #telegram: TelegramNotifier;

  constructor(options: {
    resendApiKey: string | undefined;
    resendFromEmail: string;
    telegramBotToken: string | undefined;
    telegramChatId: string | undefined;
  }) {
    this.#email = new EmailNotifier({
      apiKey: options.resendApiKey,
      from: options.resendFromEmail,
    });
    this.#telegram = new TelegramNotifier({
      botToken: options.telegramBotToken,
      defaultChatId: options.telegramChatId,
    });
  }

  async paymentApproved(options: {
    business: BusinessPayroll;
    paymentId: number;
    workerName: string;
  }): Promise<void> {
    const payment = formatPaymentId(options.paymentId);
    await this.sendBoth({
      contractId: options.business.contract_id,
      emailTo: options.business.owner_email,
      telegramChatId: options.business.telegram_chat_id,
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
    paymentId: number;
    reason: string;
  }): Promise<void> {
    const payment = formatPaymentId(options.paymentId);
    await this.sendBoth({
      contractId: options.business.contract_id,
      emailTo: options.business.owner_email,
      telegramChatId: options.business.telegram_chat_id,
      subject: `Payment #${payment} rejected: ${options.reason}`,
      emailText:
        `Payment #${payment} was rejected by ${options.business.contract_id}. ` +
        `Reason: ${options.reason}`,
      telegramText:
        `❌ Payment rejected · ${options.reason} · ${options.business.contract_id}`,
    });
  }

  async anomalyDetected(options: {
    business: BusinessPayroll;
    anomaly: Anomaly;
  }): Promise<void> {
    const time = new Date(options.anomaly.timestamp).toISOString().slice(11, 16);
    await this.sendBoth({
      contractId: options.business.contract_id,
      emailTo: options.business.owner_email,
      telegramChatId: options.business.telegram_chat_id,
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
    reportDate: string;
    summary: DailyReportSummary;
  }): Promise<void> {
    const { summary } = options;
    await this.sendBoth({
      contractId: options.business.contract_id,
      emailTo: options.business.owner_email,
      telegramChatId: options.business.telegram_chat_id,
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

  private async sendBoth(options: {
    contractId: string;
    emailTo: string;
    telegramChatId: string | undefined;
    subject: string;
    emailText: string;
    telegramText: string;
  }): Promise<void> {
    const [email, telegram] = await Promise.allSettled([
      this.#email.send({
        to: options.emailTo,
        subject: options.subject,
        text: options.emailText,
      }),
      this.#telegram.send(options.telegramText, options.telegramChatId),
    ]);

    for (const [channel, result] of [
      ["email", email],
      ["telegram", telegram],
    ] as const) {
      if (result.status === "rejected") {
        logger.error("notification.failed", {
          contractId: options.contractId,
          channel,
          error: errorMessage(result.reason),
        });
      } else if (result.value === "skipped") {
        logger.warn("notification.skipped", {
          contractId: options.contractId,
          channel,
        });
      }
    }
  }
}

function formatPaymentId(paymentId: number): string {
  return String(paymentId).padStart(3, "0");
}
