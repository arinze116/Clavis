import { describe, expect, it } from "vitest";

import type { IntentStore } from "./intent-store.js";
import type { IntentClient } from "./intents.js";
import type { NotificationManager } from "./notifications/index.js";
import type { StateStore } from "./state.js";
import { isPaymentDue, submitPendingIntents } from "./trigger.js";
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
