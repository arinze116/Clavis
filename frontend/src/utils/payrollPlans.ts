import type { Wallet } from "@near-wallet-selector/core";

import type { RecipientDraft } from "../types";
import { hashWalletAddress } from "./contract";
import { nearToYocto } from "./format";
import {
  agentResponseError,
  postAgentApi,
  signAgentAuthorization,
  storeAgentTransactionSession,
} from "./notifications";

const nearAccountPattern = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

interface PrivatePayrollRecipient {
  recipientHash: string;
  name: string;
  nearAddress: string;
  amountYocto: string;
  milestoneReady: boolean;
  destinations: Array<{
    chain: RecipientDraft["preferredChain"];
    token: RecipientDraft["preferredToken"];
    address: string;
    percentage: number;
  }>;
}

export function validateAgentRecipientDraft(
  draft: RecipientDraft,
  perPaymentLimitNear?: string,
): string | null {
  const walletAddress = draft.walletAddress.trim().toLowerCase();
  if (!nearAccountPattern.test(walletAddress)) {
    return "Enter a valid NEAR testnet wallet address for the worker.";
  }

  let amountYocto: bigint;
  let capYocto: bigint;
  try {
    amountYocto = BigInt(nearToYocto(draft.paymentAmountNear));
    capYocto = BigInt(nearToYocto(draft.personalCapNear));
  } catch {
    return "Enter positive NEAR amounts for the scheduled payment and personal cap.";
  }
  if (amountYocto <= 0n || capYocto <= 0n) {
    return "Enter positive NEAR amounts for the scheduled payment and personal cap.";
  }
  if (amountYocto > capYocto) {
    return "The scheduled payment must be less than or equal to the recipient's personal cap.";
  }
  if (perPaymentLimitNear) {
    try {
      if (amountYocto > BigInt(nearToYocto(perPaymentLimitNear))) {
        return "The scheduled payment cannot exceed the treasury per-payment limit.";
      }
    } catch {
      return "The treasury per-payment limit is invalid.";
    }
  }

  if (draft.preferredChain === "near") return null;
  if (!evmAddressPattern.test(draft.destinationAddress.trim())) {
    return `Enter a valid 0x destination address for ${
      draft.preferredChain === "ethereum" ? "Ethereum" : "BNB Chain"
    }.`;
  }
  return null;
}

export async function syncPayrollPlan(options: {
  wallet: Wallet;
  accountId: string;
  contractId: string;
  recipients: RecipientDraft[];
}): Promise<void> {
  const payload = {
    contractId: options.contractId,
    recipients: await Promise.all(options.recipients.map(recipientPlanFromDraft)),
  };
  await sendSignedPlanAction({
    wallet: options.wallet,
    accountId: options.accountId,
    action: "sync_payroll_plan",
    payload,
  });
}

export async function upsertPayrollRecipient(options: {
  wallet: Wallet;
  accountId: string;
  contractId: string;
  recipient: RecipientDraft;
  expectedRecipientHash?: string;
}): Promise<void> {
  const recipient = await recipientPlanFromDraft(options.recipient);
  if (
    options.expectedRecipientHash &&
    recipient.recipientHash !== options.expectedRecipientHash
  ) {
    throw new Error("The re-entered worker wallet does not match this private recipient hash.");
  }
  await sendSignedPlanAction({
    wallet: options.wallet,
    accountId: options.accountId,
    action: "upsert_payroll_recipient",
    payload: { contractId: options.contractId, recipient },
  });
}

export async function removePayrollRecipient(options: {
  wallet: Wallet;
  accountId: string;
  contractId: string;
  recipientHash: string;
}): Promise<void> {
  await sendSignedPlanAction({
    wallet: options.wallet,
    accountId: options.accountId,
    action: "remove_payroll_recipient",
    payload: {
      contractId: options.contractId,
      recipientHash: options.recipientHash,
    },
  });
}

async function recipientPlanFromDraft(
  draft: RecipientDraft,
): Promise<PrivatePayrollRecipient> {
  const validationError = validateAgentRecipientDraft(draft);
  if (validationError) throw new Error(validationError);
  const nearAddress = draft.walletAddress.trim().toLowerCase();
  return {
    recipientHash: await hashWalletAddress(nearAddress),
    name: draft.name.trim(),
    nearAddress,
    amountYocto: nearToYocto(draft.paymentAmountNear),
    milestoneReady: false,
    destinations: [
      {
        chain: draft.preferredChain,
        token: draft.preferredToken,
        address:
          draft.preferredChain === "near"
            ? nearAddress
            : draft.destinationAddress.trim(),
        percentage: 100,
      },
    ],
  };
}

async function sendSignedPlanAction(options: {
  wallet: Wallet;
  accountId: string;
  action:
    | "sync_payroll_plan"
    | "upsert_payroll_recipient"
    | "remove_payroll_recipient";
  payload: unknown;
}): Promise<void> {
  const authorization = await signAgentAuthorization(options);
  const response = await postAgentApi({
    action: options.action,
    payload: options.payload,
    authorization,
  });
  if (!response.ok) throw await agentResponseError(response);
  const result = (await response.json()) as {
    sessionToken?: unknown;
    sessionExpiresAt?: unknown;
  };
  if (
    typeof result.sessionToken !== "string" ||
    typeof result.sessionExpiresAt !== "string"
  ) {
    throw new Error("The payroll agent did not return a transaction notification session.");
  }
  storeAgentTransactionSession({
    accountId: options.accountId,
    sessionToken: result.sessionToken,
    sessionExpiresAt: result.sessionExpiresAt,
  });
}
