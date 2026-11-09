import { describe, expect, it, vi } from "vitest";

import type { IntentStore } from "./intent-store.js";
import type { IntentClient } from "./intents.js";
import type { NotificationManager } from "./notifications/index.js";
import type { StateStore } from "./state.js";
import type { NearClient } from "./near.js";
import {
  isPaymentDue,
  isPaymentSubmissionAllowed,
  submitPendingIntents,
  triggerDuePayments,
} from "./trigger.js";
import type {
  AgentState,
  BusinessPayroll,
  IntentEnvelope,
  IntentRecord,
  PayrollRecipient,
  RecipientView,
} from "./types.js";

const recipientHash = "a".repeat(64);

function state(completedMilestone?: string): AgentState {
  return {
    version: 1,
    lastReportDate: null,
    routeFingerprints: {},
    completedMilestones: completedMilestone
      ? { [recipientHash]: completedMilestone }
      : {},
    anomalyNotifications: {},
    requests: [],
    payments: [],
    pendingIntents: [],
  };
}

const milestoneRecipient: RecipientView = {
  recipient_hash: recipientHash,
  name: "Chidi",
  personal_cap: "100",
  active: true,
  preferred_chain: "bnb",
  preferred_token: "BUSD",
  payment_split: [],
  schedule: "Milestone",
  last_paid: 0,
  next_payment_at: null,
};

function plan(milestoneId: string): PayrollRecipient {
  return {
    recipientHash,
    name: "Chidi",
    nearAddress: "chidi.testnet",
    amountYocto: "50",
    milestoneReady: true,
    milestoneId,
    destinations: [
      {
        chain: "bnb",
        token: "BUSD",
        address: "0x3333333333333333333333333333333333333333",
        percentage: 100,
      },
    ],
  };
}

describe("isPaymentDue", () => {
  it("triggers a milestone once per stable milestone ID", () => {
    expect(isPaymentDue(milestoneRecipient, plan("delivery-1"), state(), 0n)).toBe(true);
    expect(
      isPaymentDue(
        milestoneRecipient,
        plan("delivery-1"),
        state("delivery-1"),
        0n,
      ),
    ).toBe(false);
    expect(
      isPaymentDue(
        milestoneRecipient,
        plan("delivery-2"),
        state("delivery-1"),
        0n,
      ),
    ).toBe(true);
  });
});

describe("triggerDuePayments", () => {
  it("skips new contract submissions at 01:00 UTC but still processes pending intents", async () => {
    const now = new Date("2026-11-03T01:00:00.000Z");
    const envelope: IntentEnvelope = {
      intentId: "intent-off-hours",
      contractId: "acme.clavis.testnet",
      paymentId: 7,
      recipientHash,
      recipientName: "Chidi",
      nearRecipient: "chidi.testnet",
      sourceAsset: "NEAR",
      sourceAmountYocto: "50",
      destination: plan("delivery-1").destinations[0]!,
      createdAt: "2026-11-03T00:30:00.000Z",
    };
    const record: IntentRecord = {
      ...envelope,
      status: "FILLED",
      attempts: 1,
      reference: "relay-reference",
      updatedAt: "2026-11-03T00:31:00.000Z",
    };
    const requestPayment = vi.fn();
    const markIntentFilled = vi.fn(async () => undefined);
    const deliveryFilled = vi.fn(async () => undefined);

    await triggerDuePayments({
      contractId: "acme.clavis.testnet",
      near: { requestPayment } as unknown as NearClient,
      intents: { preflight: vi.fn(async () => undefined) } as unknown as IntentClient,
      intentStore: {
        ensurePending: vi.fn(async () => record),
      } as unknown as IntentStore,
      state: {
        value: { ...state(), pendingIntents: [envelope] },
        markIntentFilled,
      } as unknown as StateStore,
      business: {
        contract_id: "acme.clavis.testnet",
        owner_email: "owner@example.com",
        telegram_chat_id: undefined,
        recipients: [plan("delivery-1")],
      },
      recipients: [milestoneRecipient],
      notifications: { deliveryFilled } as unknown as NotificationManager,
      intentRetryDelayMs: 30_000,
      now,
    });

    expect(isPaymentSubmissionAllowed(now)).toBe(false);
    expect(requestPayment).not.toHaveBeenCalled();
    expect(markIntentFilled).toHaveBeenCalledWith(envelope.intentId);
    expect(deliveryFilled).toHaveBeenCalledOnce();
  });

  it("submits a due payment from 06:00 UTC onward", async () => {
    const now = new Date("2026-11-03T06:00:00.000Z");
    const requestPayment = vi.fn(async () => ({
      approved: true,
      payment_id: 8,
      reason: null,
      settled: true,
      transaction_hash: "contract-settlement-transaction",
    }));
    const recordRequest = vi.fn(async () => undefined);
    const recordPayment = vi.fn(async () => undefined);
    const paymentApproved = vi.fn(async () => undefined);
    const deliveryFilled = vi.fn(async () => undefined);
    const preflight = vi.fn(async () => undefined);

    await triggerDuePayments({
      contractId: "acme.clavis.testnet",
      near: { requestPayment } as unknown as NearClient,
      intents: { preflight } as unknown as IntentClient,
      intentStore: {
        ensurePending: vi.fn(async () => ({ status: "PENDING" })),
      } as unknown as IntentStore,
      state: {
        value: state(),
        recordRequest,
        recordPayment,
      } as unknown as StateStore,
      business: {
        contract_id: "acme.clavis.testnet",
        owner_email: "owner@example.com",
        telegram_chat_id: undefined,
        recipients: [plan("delivery-1")],
      },
      recipients: [milestoneRecipient],
      notifications: { paymentApproved, deliveryFilled } as unknown as NotificationManager,
      intentRetryDelayMs: 30_000,
      now,
    });

    expect(isPaymentSubmissionAllowed(now)).toBe(true);
    expect(preflight).toHaveBeenCalledOnce();
    expect(requestPayment).toHaveBeenCalledOnce();
    expect(preflight.mock.invocationCallOrder[0]).toBeLessThan(
      requestPayment.mock.invocationCallOrder[0]!,
    );
    expect(recordRequest).toHaveBeenCalledOnce();
    expect(recordPayment).toHaveBeenCalledOnce();
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DELIVERED" }),
      [],
      expect.anything(),
    );
    expect(paymentApproved).toHaveBeenCalledOnce();
    expect(deliveryFilled).toHaveBeenCalledWith(
      expect.objectContaining({ transactionHash: "contract-settlement-transaction" }),
    );
  });

  it("does not consume authorization when settlement preflight fails", async () => {
    const requestPayment = vi.fn();
    const recordRequest = vi.fn();
    const recordPayment = vi.fn();

    await triggerDuePayments({
      contractId: "acme.clavis.testnet",
      near: { requestPayment } as unknown as NearClient,
      intents: {
        preflight: vi.fn(async () => {
          throw new Error("No solver quote is available");
        }),
      } as unknown as IntentClient,
      intentStore: {} as IntentStore,
      state: {
        value: state(),
        recordRequest,
        recordPayment,
      } as unknown as StateStore,
      business: {
        contract_id: "acme.clavis.testnet",
        owner_email: "owner@example.com",
        telegram_chat_id: undefined,
        recipients: [plan("delivery-1")],
      },
      recipients: [milestoneRecipient],
      notifications: {} as NotificationManager,
      intentRetryDelayMs: 30_000,
      now: new Date("2026-11-03T06:00:00.000Z"),
    });

    expect(requestPayment).not.toHaveBeenCalled();
    expect(recordRequest).not.toHaveBeenCalled();
    expect(recordPayment).not.toHaveBeenCalled();
  });
});

describe("submitPendingIntents", () => {
  it("alerts and removes a filled intent without submitting it again", async () => {
    const envelope: IntentEnvelope = {
      intentId: "intent-1",
      contractId: "acme.clavis.testnet",
      paymentId: 7,
      recipientHash,
      recipientName: "Chidi",
      nearRecipient: "chidi.testnet",
      sourceAsset: "NEAR",
      sourceAmountYocto: "50",
      destination: {
        chain: "near",
        token: "NEAR",
        address: "chidi.testnet",
        percentage: 100,
      },
      createdAt: "2026-11-03T08:00:00.000Z",
    };
    const record: IntentRecord = {
      ...envelope,
      status: "PENDING",
      attempts: 1,
      reference: "relay-reference",
      updatedAt: "2026-11-03T08:00:00.000Z",
    };
    let submissions = 0;
    let filledAlerts = 0;
    let removed = 0;
    const intents = {
      getStatus: async () => "FILLED",
      submit: async () => {
        submissions += 1;
        throw new Error("should not submit");
      },
    } as unknown as IntentClient;
    const intentStore = {
      ensurePending: async () => record,
      markStatus: async () => {
        record.status = "FILLED";
        return record;
      },
    } as unknown as IntentStore;
    const stateStore = {
      value: { ...state(), pendingIntents: [envelope] },
      markIntentFilled: async () => {
        removed += 1;
      },
    } as unknown as StateStore;
    const notifications = {
      deliveryFilled: async () => {
        filledAlerts += 1;
      },
    } as unknown as NotificationManager;
    const business: BusinessPayroll = {
      contract_id: "acme.clavis.testnet",
      owner_email: "owner@example.com",
      telegram_chat_id: undefined,
      recipients: [plan("delivery-1")],
    };

    await submitPendingIntents({
      contractId: business.contract_id,
      intents,
      intentStore,
      state: stateStore,
      business,
      ownerAccountId: "owner.testnet",
      notifications,
      retryDelayMs: 30_000,
      now: new Date("2026-11-03T08:01:00.000Z"),
    });

    expect(filledAlerts).toBe(1);
    expect(removed).toBe(1);
    expect(submissions).toBe(0);
  });
});
