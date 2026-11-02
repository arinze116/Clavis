import type { IntentClient } from "./intents.js";
import { buildIntentEnvelopes } from "./intents.js";
import { errorMessage, logger, maskHash } from "./logger.js";
import type { NearClient } from "./near.js";
import type { AgentState, PayrollFile, PayrollRecipient, RecipientView } from "./types.js";
import type { StateStore } from "./state.js";

export function isPaymentDue(
  recipient: RecipientView,
  plan: PayrollRecipient,
  state: Readonly<AgentState>,
  nowNs: bigint,
): boolean {
  if (!recipient.active) {
    return false;
  }
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
  near: NearClient;
  intents: IntentClient;
  state: StateStore;
  payroll: PayrollFile;
  recipients: RecipientView[];
  now?: Date;
}): Promise<void> {
  const now = options.now ?? new Date();
  const nowNs = BigInt(now.getTime()) * 1_000_000n;
  const plans = new Map(
    options.payroll.recipients.map((recipient) => [recipient.recipientHash, recipient]),
  );

  for (const recipient of options.recipients) {
    const plan = plans.get(recipient.recipient_hash);
    if (!plan || !isPaymentDue(recipient, plan, options.state.value, nowNs)) {
      continue;
    }

    const primaryRoute = plan.destinations[0];
    if (!primaryRoute) {
      continue;
    }

    await options.state.recordRequest({
      recipientHash: plan.recipientHash,
      timestamp: now.getTime(),
    });

    logger.info("payment.requested", {
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
        logger.warn("payment.rejected", {
          paymentId: result.payment_id,
          reason: result.reason ?? "Policy rejected the request",
        });
        continue;
      }

      const envelopes = buildIntentEnvelopes(result.payment_id, plan, now);
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
      logger.info("payment.approved", {
        paymentId: result.payment_id,
        routes: envelopes.length,
      });
    } catch (error) {
      logger.error("payment.request_failed", { error: errorMessage(error) });
    }
  }

  await submitPendingIntents(options.intents, options.state);
}

export async function submitPendingIntents(
  intents: IntentClient,
  state: StateStore,
): Promise<void> {
  for (const envelope of [...state.value.pendingIntents]) {
    try {
      const result = await intents.submit(envelope);
      await state.markIntentSubmitted(envelope.intentId);
      logger.info("intent.submitted", {
        paymentId: envelope.paymentId,
        intentId: envelope.intentId,
        status: result.status,
        reference: result.reference,
      });
    } catch (error) {
      const message = errorMessage(error);
      await state.markIntentFailed(envelope.intentId, message);
      logger.error("intent.submission_failed", {
        paymentId: envelope.paymentId,
        intentId: envelope.intentId,
        error: message,
      });
    }
  }
}
