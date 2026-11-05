import { errorMessage, logger } from "./logger.js";
import type { NotificationPreferenceStore } from "./notification-preferences.js";
import { TelegramNotifier } from "./notifications/telegram.js";

const RETRY_DELAY_MS = 5_000;
const LONG_POLL_TIMEOUT_SECONDS = 20;
const REQUEST_TIMEOUT_MS = 30_000;

interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat: { id: number; type: string };
  };
}

interface TelegramUpdatesResponse {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
}

export class TelegramLinkPoller {
  readonly #botToken: string;
  readonly #store: NotificationPreferenceStore;
  readonly #notifier: TelegramNotifier;
  #running = false;
  #activeRequest: AbortController | null = null;

  constructor(options: { botToken: string; store: NotificationPreferenceStore }) {
    this.#botToken = options.botToken;
    this.#store = options.store;
    this.#notifier = new TelegramNotifier({
      botToken: options.botToken,
      defaultChatId: undefined,
    });
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    void this.run();
  }

  stop(): void {
    this.#running = false;
    this.#activeRequest?.abort();
    this.#activeRequest = null;
  }

  private async run(): Promise<void> {
    logger.info("telegram_link_poller.started");
    while (this.#running) {
      try {
        await this.pollOnce();
      } catch (error) {
        if (!this.#running) break;
        logger.warn("telegram_link_poller.failed", { error: errorMessage(error) });
        await wait(RETRY_DELAY_MS);
      }
    }
    logger.info("telegram_link_poller.stopped");
  }

  private async pollOnce(): Promise<void> {
    const controller = new AbortController();
    this.#activeRequest = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.#botToken}/getUpdates`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            offset: this.#store.getTelegramUpdateOffset(),
            timeout: LONG_POLL_TIMEOUT_SECONDS,
            allowed_updates: ["message"],
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`Telegram getUpdates failed with HTTP ${response.status}`);
      }
      const body = (await response.json()) as TelegramUpdatesResponse;
      if (!body.ok) throw new Error(body.description ?? "Telegram rejected getUpdates");

      let nextOffset = this.#store.getTelegramUpdateOffset();
      for (const update of body.result ?? []) {
        await this.handleUpdate(update);
        nextOffset = Math.max(nextOffset, update.update_id + 1);
      }
      if (nextOffset !== this.#store.getTelegramUpdateOffset()) {
        await this.#store.setTelegramUpdateOffset(nextOffset);
      }
    } finally {
      clearTimeout(timeout);
      if (this.#activeRequest === controller) this.#activeRequest = null;
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message || message.chat.type !== "private") return;
    const chatId = String(message.chat.id);
    const token = message.text?.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{20,64})$/)?.[1];
    if (!token) {
      await this.#notifier.send(
        "Open Clavis, click your wallet, then choose Connect Telegram to create a secure link.",
        chatId,
        false,
      );
      return;
    }

    const connection = await this.#store.completeTelegramPairing(token, chatId);
    if (!connection) {
      await this.#notifier.send(
        "This Clavis connection link is invalid or expired. Create a new one from the web app.",
        chatId,
        false,
      );
      return;
    }
    if (connection.newlyConnected) {
      await this.#notifier.send(
        `✅ Telegram notifications linked · ${connection.preference.accountId}`,
        chatId,
        false,
      );
    }
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
