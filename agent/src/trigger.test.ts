import { describe, expect, it } from "vitest";

import { isPaymentDue } from "./trigger.js";
import type { AgentState, PayrollRecipient, RecipientView } from "./types.js";

const recipientHash = "a".repeat(64);

function state(completedMilestone?: string): AgentState {
  return {
    version: 1,
    lastReportDate: null,
    routeFingerprints: {},
    completedMilestones: completedMilestone
      ? { [recipientHash]: completedMilestone }
      : {},
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
