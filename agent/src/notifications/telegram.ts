export class TelegramNotifier {
  readonly #botToken: string | undefined;
  readonly #defaultChatId: string | undefined;

  constructor(options: {
    botToken: string | undefined;
    defaultChatId: string | undefined;
  }) {
    this.#botToken = options.botToken;
    this.#defaultChatId = options.defaultChatId;
  }

  async send(
    message: string,
    chatId: string | undefined,
    allowDefault = true,
  ): Promise<"sent" | "skipped"> {
    const destination = chatId ?? (allowDefault ? this.#defaultChatId : undefined);
    if (!this.#botToken || !destination) return "skipped";

    const response = await fetch(
      `https://api.telegram.org/bot${this.#botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: destination,
          text: message,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Telegram notification failed with HTTP ${response.status}: ${body.slice(0, 200)}`,
      );
    }
    return "sent";
  }
}
