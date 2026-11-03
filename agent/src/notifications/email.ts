import { Resend } from "resend";

export class EmailNotifier {
  readonly #client: Resend | null;
  readonly #from: string;

  constructor(options: { apiKey: string | undefined; from: string }) {
    this.#client = options.apiKey ? new Resend(options.apiKey) : null;
    this.#from = options.from;
  }

  async send(options: {
    to: string | undefined;
    subject: string;
    text: string;
  }): Promise<"sent" | "skipped"> {
    if (
      !this.#client ||
      !options.to ||
      options.to === "notifications-disabled@example.com"
    ) {
      return "skipped";
    }

    const { error } = await this.#client.emails.send({
      from: this.#from,
      to: options.to,
      subject: options.subject,
      text: options.text,
    });
    if (error) {
      throw new Error(`Resend rejected the notification: ${error.message}`);
    }
    return "sent";
  }
}
