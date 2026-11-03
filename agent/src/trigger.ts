import type { IntentStore } from "./intent-store.js";
import type { IntentClient } from "./intents.js";
import { buildIntentEnvelopes } from "./intents.js";
import { errorMessage, logger, maskHash } from "./logger.js";
import type { NearClient } from "./near.js";
import type { NotificationManager } from "./notifications/index.js";
import type { StateStore } from "./state.js";
import type {
  AgentState,
  BusinessPayroll,
  PayrollRecipient,
  RecipientView,
} from "./types.js";

const MAX_SUBMISSION_ATTEMPTS = 4; // initial attempt plus three retries

export function isPaymentDue(
  recipient: RecipientView,
  plan: PayrollRecipient,
  state: Readonly<AgentState>,
  nowNs: bigint,
): boolean {
  if (!recipient.active) return false;
  if (recipient.schedule === "Milestone") {
    return Boolean(
      plan.milestoneReady &&
        plan.milestoneId &&
        state.completedMilestones[plan.recipientHash] !== plan.milestoneId,
    );
  }
  return recipient.next_payment_at !== null && BigInt(recipient.next_payment_at) <= nowNs;
}

export async function triggerDuePayments(options: {
  contractId: string;
  near: NearClient;
  intents: IntentClient;
  intentStore: IntentStore;
  state: StateStore;
  business: BusinessPayroll;
  recipients: RecipientView[];
  notifications: NotificationManager;
  intentRetryDelayMs: number;
  now?: Date;
}): Promise<void> {
  const now = options.now ?? new Date();
  const nowNs = BigInt(now.getTime()) * 1_000_000n;
  const plans = new Map(
    options.business.recipients.map((recipient) => [recipient.recipientHash, recipient]),
  );

  for (const recipient of options.recipients) {
    const plan = plans.get(recipient.recipient_hash);
    if (!plan || !isPaymentDue(recipient, plan, options.state.value, nowNs)) continue;

    const primaryRoute = plan.destinations[0];
    if (!primaryRoute) continue;

    await options.state.recordRequest({
      recipientHash: plan.recipientHash,
      timestamp: now.getTime(),
    });
    logger.info("payment.requested", {
      contractId: options.contractId,
      recipient: maskHash(plan.recipientHash),
      schedule: recipient.schedule,
    });

    try {
      const result = await options.near.requestPayment({
        recipientHash: plan.recipientHash,
        amountYocto: plan.amountYocto,
        chain: primaryRoute.chain,
        token: primaryRoute.token,
      });

      if (!result.approved) {
        const reason = result.reason ?? "Policy rejected the request";
        logger.warn("payment.rejected", {
          contractId: options.contractId,
          paymentId: result.payment_id,
          reason,
        });
        await options.notifications.paymentRejected({
          business: options.business,
          paymentId: result.payment_id,
          reason,
        });
        continue;
      }

      const envelopes = buildIntentEnvelopes(
        options.contractId,
        result.payment_id,
        plan,
        now,
      );
      const milestone =
        recipient.schedule === "Milestone" && plan.milestoneId
          ? { recipientHash: plan.recipientHash, milestoneId: plan.milestoneId }
          : undefined;
      await options.state.recordPayment(
        {
          paymentId: result.payment_id,
          recipientHash: plan.recipientHash,
          amountYocto: plan.amountYocto,
          approvedAt: now.getTime(),
          status: "PENDING_DELIVERY",
        },
        envelopes,
        milestone,
      );
      for (const envelope of envelopes) {
        await options.intentStore.ensurePending(envelope);
      }
      logger.info("payment.approved", {
        contractId: options.contractId,
        paymentId: result.payment_id,
        routes: envelopes.length,
      });
      await options.notifications.paymentApproved({
        business: options.business,
        paymentId: result.payment_id,
        workerName: plan.name,
      });
    } catch (error) {
      logger.error("payment.request_failed", {
        contractId: options.contractId,
        error: errorMessage(error),
      });
    }
  }

  await submitPendingIntents({
    contractId: options.contractId,
    intents: options.intents,
    intentStore: options.intentStore,
    state: options.state,
    retryDelayMs: options.intentRetryDelayMs,
    now,
  });
}

export async function submitPendingIntents(options: {
  contractId: string;
  intents: IntentClient;
  intentStore: IntentStore;
  state: StateStore;
  retryDelayMs: number;
  now?: Date;
}): Promise<void> {
  const now = options.now ?? new Date();
  for (const envelope of [...options.state.value.pendingIntents]) {
    let record = await options.intentStore.ensurePending(envelope);

    if (record.status === "FILLED") {
      await options.state.markIntentFilled(envelope.intentId);
      continue;
    }

    if (record.status === "PENDING" && record.reference) {
      try {
        const status = await options.intents.getStatus(record.reference);
        if (status === "FILLED") {
          await options.intentStore.markStatus(envelope.intentId, "FILLED");
          await options.state.markIntentFilled(envelope.intentId);
          logger.info("intent.filled", {
            contractId: options.contractId,
            paymentId: envelope.paymentId,
            intentId: envelope.intentId,
            reference: record.reference,
          });
        } else if (status === "FAILED") {
          record = await options.intentStore.markRelayFailed(
            envelope.intentId,
            "Solver relay reported the intent as invalid or not found",
            options.retryDelayMs,
          );
        }
      } catch (error) {
        logger.warn("intent.status_unavailable", {
          contractId: options.contractId,
          paymentId: envelope.paymentId,
          intentId: envelope.intentId,
          error: errorMessage(error),
        });
      }
      if (record.status === "PENDING") continue;
    }

    if (record.attempts >= MAX_SUBMISSION_ATTEMPTS) {
      await options.state.markIntentTerminalFailure(envelope.intentId);
      logger.error("intent.retry_exhausted", {
        contractId: options.contractId,
        paymentId: envelope.paymentId,
        intentId: envelope.intentId,
        attempts: record.attempts,
      });
      continue;
    }

    if (record.nextRetryAt && Date.parse(record.nextRetryAt) > now.getTime()) continue;

    try {
      const result = await options.intents.submit(envelope);
      record = await options.intentStore.recordSubmission(envelope.intentId, result);
      logger.info("intent.submitted", {
        contractId: options.contractId,
        paymentId: envelope.paymentId,
        intentId: envelope.intentId,
        status: result.status,
        reference: result.reference,
        fallback: result.fallback,
      });
      if (record.status === "FILLED") {
        await options.state.markIntentFilled(envelope.intentId);
      }
    } catch (error) {
      const message = errorMessage(error);
      record = await options.intentStore.markFailed(
        envelope.intentId,
        message,
        options.retryDelayMs,
      );
      logger.error("intent.submission_failed", {
        contractId: options.contractId,
        paymentId: envelope.paymentId,
        intentId: envelope.intentId,
        attempts: record.attempts,
        error: message,
      });
      if (record.attempts >= MAX_SUBMISSION_ATTEMPTS) {
        await options.state.markIntentTerminalFailure(envelope.intentId);
      }
    }
  }
}
