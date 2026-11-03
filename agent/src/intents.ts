import { createHash } from "node:crypto";

import { createSolverRelayClient, type RelayQuote } from "@fastnear/intents";
import { createLocalIntentSigner } from "@fastnear/intents/node";

import { logger } from "./logger.js";
import type { NearTransferClient } from "./near.js";
import type {
  Destination,
  IntentEnvelope,
  IntentStatus,
  IntentSubmission,
  PayrollRecipient,
} from "./types.js";

const TESTNET_ASSETS = {
  near: "nep141:wrap.testnet",
  ethereum: "nep141:usdc.fakes.testnet",
  bnb: "nep141:wrap.testnet",
} as const;

export interface TokenDiffIntent {
  intent_type: "token_diff";
  diff: Record<string, string>;
  deadline: { timestamp: number };
}

export interface IntentClientOptions {
  solverRelayUrl: string;
  apiKey: string | undefined;
  intentsContractId: string;
  signerAccountId: string | undefined;
  signerPrivateKey: string | undefined;
  transferClient: NearTransferClient | undefined;
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

export function buildTokenDiffIntent(
  amountYocto: string,
  outputAsset: string,
  outputAmount: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): TokenDiffIntent {
  if (outputAsset === TESTNET_ASSETS.near) {
    throw new Error("A token-diff intent requires different input and output assets");
  }
  return {
    intent_type: "token_diff",
    diff: {
      [TESTNET_ASSETS.near]: `-${amountYocto}`,
      [outputAsset]: `+${outputAmount}`,
    },
    deadline: { timestamp: nowSeconds + 120 },
  };
}

function outputAsset(destination: Destination): string {
  return TESTNET_ASSETS[destination.chain];
}

export class IntentClient {
  readonly #options: IntentClientOptions;
  readonly #relay: ReturnType<typeof createSolverRelayClient>;
  readonly #signer: ReturnType<typeof createLocalIntentSigner> | null;

  constructor(options: IntentClientOptions) {
    this.#options = options;
    this.#relay = createSolverRelayClient({
      url: options.solverRelayUrl,
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    });
    this.#signer =
      options.signerAccountId && options.signerPrivateKey
        ? createLocalIntentSigner({
            accountId: options.signerAccountId,
            privateKey: options.signerPrivateKey,
          })
        : null;
  }

  async submit(envelope: IntentEnvelope): Promise<IntentSubmission> {
    const assetOut = outputAsset(envelope.destination);
    if (assetOut === TESTNET_ASSETS.near) {
      return this.fallbackToNear(
        envelope,
        `${envelope.destination.chain} testnet routes use the wrapped NEAR equivalent`,
      );
    }
    let quote: RelayQuote | undefined;
    try {
      const quotes = await this.#relay.quote({
        defuse_asset_identifier_in: TESTNET_ASSETS.near,
        defuse_asset_identifier_out: assetOut,
        exact_amount_in: envelope.sourceAmountYocto,
        min_deadline_ms: 120_000,
      });
      quote = quotes?.[0];
    } catch (error) {
      logger.warn("intent.quote_unavailable", {
        contractId: envelope.contractId,
        paymentId: envelope.paymentId,
        error: error instanceof Error ? error.message : "Unknown quote error",
      });
    }

    if (!quote || !this.#signer) {
      return this.fallbackToNear(
        envelope,
        quote ? "intent signer is not configured" : "no solver quote was available",
      );
    }

    const requestedIntent = buildTokenDiffIntent(
      quote.amount_in,
      quote.defuse_asset_identifier_out,
      quote.amount_out,
    );
    const signedData = await this.#signer.signIntents({
      signerId: this.#options.signerAccountId!,
      verifyingContract: this.#options.intentsContractId,
      deadline: quote.expiration_time,
      intents: [
        {
          intent: "token_diff",
          diff: requestedIntent.diff,
          memo: `Clavis ${envelope.contractId} payment #${envelope.paymentId}`,
        },
      ],
    });
    const result = await this.#relay.publishIntent({
      signedData,
      quoteHashes: [quote.quote_hash],
    });
    if (!result.intent_hash) {
      throw new Error("NEAR Intents relay returned no intent hash");
    }

    return {
      intentId: envelope.intentId,
      status: "PENDING",
      reference: result.intent_hash,
      fallback: false,
    };
  }

  async getStatus(reference: string): Promise<IntentStatus> {
    const result = await this.#relay.getStatus({ intentHash: reference });
    if (result.status === "SETTLED") return "FILLED";
    if (result.status === "NOT_FOUND_OR_NOT_VALID") return "FAILED";
    return "PENDING";
  }

  private async fallbackToNear(
    envelope: IntentEnvelope,
    reason: string,
  ): Promise<IntentSubmission> {
    logger.warn("intent.direct_near_fallback", {
      contractId: envelope.contractId,
      paymentId: envelope.paymentId,
      reason,
    });
    if (!this.#options.transferClient) {
      throw new Error(
        `Solver unavailable and direct NEAR fallback cannot run: ${reason}; configure settlement credentials`,
      );
    }
    if (!envelope.nearRecipient) {
      throw new Error(
        "Solver unavailable and the payroll plan has no recipient NEAR address for fallback",
      );
    }

    const transactionHash = await this.#options.transferClient.transferNear(
      envelope.nearRecipient,
      envelope.sourceAmountYocto,
    );
    return {
      intentId: envelope.intentId,
      status: "FILLED",
      reference: transactionHash,
      transactionHash,
      fallback: true,
    };
  }
}

export function routeFingerprint(destinations: Destination[]): string {
  return createHash("sha256").update(JSON.stringify(destinations)).digest("hex");
}
