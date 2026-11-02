import { createHash } from "node:crypto";

import type {
  Destination,
  IntentEnvelope,
  IntentSubmission,
  PayrollRecipient,
} from "./types.js";

export interface IntentClientOptions {
  dryRun: boolean;
  confidentialExecutorUrl: string | undefined;
  apiKey: string | undefined;
  intentsContractId: string;
}

export function buildIntentEnvelopes(
  paymentId: number,
  recipient: PayrollRecipient,
  createdAt = new Date(),
): IntentEnvelope[] {
  const total = BigInt(recipient.amountYocto);
  let allocated = 0n;

  return recipient.destinations.map((destination, index) => {
    const isLast = index === recipient.destinations.length - 1;
    const amount = isLast
      ? total - allocated
      : (total * BigInt(destination.percentage)) / 100n;
    allocated += amount;

    return {
      intentId: `${paymentId}:${index + 1}`,
      paymentId,
      recipientHash: recipient.recipientHash,
      sourceAsset: "NEAR",
      sourceAmountYocto: amount.toString(),
      destination,
      createdAt: createdAt.toISOString(),
      attempts: 0,
    };
  });
}

export class IntentClient {
  readonly #options: IntentClientOptions;

  constructor(options: IntentClientOptions) {
    this.#options = options;
  }

  async submit(envelope: IntentEnvelope): Promise<IntentSubmission> {
    if (this.#options.dryRun) {
      return {
        intentId: envelope.intentId,
        status: "SIMULATED",
        reference: createHash("sha256")
          .update(JSON.stringify(envelope))
          .digest("hex")
          .slice(0, 32),
      };
    }

    if (!this.#options.confidentialExecutorUrl) {
      throw new Error(
        "CONFIDENTIAL_EXECUTOR_URL is required when DRY_RUN_INTENTS is false",
      );
    }

    // Sensitive fields are sent only to the configured confidential executor
    // over TLS. They are never included in application logs or public events.
    const response = await fetch(this.#options.confidentialExecutorUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.#options.apiKey
          ? { authorization: `Bearer ${this.#options.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        protocol: "near-intents",
        intentsContractId: this.#options.intentsContractId,
        authorization: envelope,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Confidential executor returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as { reference?: string };
    if (!body.reference) {
      throw new Error("Confidential executor returned no submission reference");
    }

    return {
      intentId: envelope.intentId,
      status: "SUBMITTED",
      reference: body.reference,
    };
  }
}

export function routeFingerprint(destinations: Destination[]): string {
  return createHash("sha256")
    .update(JSON.stringify(destinations))
    .digest("hex");
}
