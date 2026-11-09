import { createHash } from "node:crypto";

import { createSolverRelayClient } from "@fastnear/intents";

import type {
  Destination,
  IntentEnvelope,
  IntentStatus,
  IntentSubmission,
  PayrollRecipient,
} from "./types.js";

export interface IntentClientOptions {
  solverRelayUrl: string;
  apiKey: string | undefined;
}

export function buildIntentEnvelopes(
  contractId: string,
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
      intentId: `${contractId}:${paymentId}:${index + 1}`,
      contractId,
      paymentId,
      recipientHash: recipient.recipientHash,
      recipientName: recipient.name,
      nearRecipient: recipient.nearAddress,
      sourceAsset: "NEAR",
      sourceAmountYocto: amount.toString(),
      destination,
      createdAt: createdAt.toISOString(),
    };
  });
}

export class IntentClient {
  readonly #relay: ReturnType<typeof createSolverRelayClient>;

  constructor(options: IntentClientOptions) {
    this.#relay = createSolverRelayClient({
      url: options.solverRelayUrl,
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    });
  }

  async preflight(envelopes: IntentEnvelope[]): Promise<void> {
    if (envelopes.length !== 1) {
      throw new Error(
        "Split and cross-chain settlement are disabled until the payroll contract controls every delivery leg",
      );
    }
    for (const envelope of envelopes) {
      if (
        envelope.destination.chain !== "near" ||
        envelope.destination.token !== "NEAR" ||
        envelope.destination.percentage !== 100
      ) {
        throw new Error(
          "Cross-chain settlement is disabled until it can preserve contract-controlled custody",
        );
      }
      if (envelope.destination.address !== envelope.nearRecipient) {
        throw new Error("Native payout destination must match the approved recipient account");
      }
    }
  }

  async submit(_envelope: IntentEnvelope): Promise<IntentSubmission> {
    throw new Error(
      "External settlement submission is disabled; native NEAR is transferred by the payroll contract",
    );
  }

  async getStatus(reference: string): Promise<IntentStatus> {
    const result = await this.#relay.getStatus({ intentHash: reference });
    if (result.status === "SETTLED") return "FILLED";
    if (result.status === "NOT_FOUND_OR_NOT_VALID") return "FAILED";
    return "PENDING";
  }
}

export function routeFingerprint(destinations: Destination[]): string {
  return createHash("sha256").update(JSON.stringify(destinations)).digest("hex");
}
