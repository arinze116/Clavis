import type { Wallet } from "@near-wallet-selector/core";

import type { ContractSnapshot, RecipientDraft } from "../types";
import {
  changeMany,
  hashWalletAddress,
  loadContractSnapshot,
  type ContractCall,
  type TransactionSubmission,
} from "./contract";
import { nearToYocto } from "./format";

const CONFIGURATION_CHUNK_SIZE = 6;
const CONFIGURATION_CALL_GAS = 35_000_000_000_000n;

export async function buildExistingBusinessCalls(options: {
  snapshot: ContractSnapshot;
  accountId: string;
  agent: string;
  dailyLimitNear: string;
  perPaymentLimitNear: string;
  recipients: RecipientDraft[];
}): Promise<ContractCall[]> {
  if (options.snapshot.owner !== options.accountId) {
    throw new Error("The connected wallet is not the owner of this payroll contract.");
  }

  const desiredDaily = nearToYocto(options.dailyLimitNear);
  const desiredPerPayment = nearToYocto(options.perPaymentLimitNear);
  const calls: ContractCall[] = [];
  if (
    desiredDaily !== options.snapshot.dailyLimit ||
    desiredPerPayment !== options.snapshot.perPaymentLimit
  ) {
    calls.push({
      methodName: "update_limits",
      args: { daily: desiredDaily, per_payment: desiredPerPayment },
      gas: CONFIGURATION_CALL_GAS,
    });
  }

  const normalizedAgent = options.agent.trim().toLowerCase();
  if (normalizedAgent !== options.snapshot.agent) {
    calls.push({
      methodName: "update_agent",
      args: { new_agent: normalizedAgent },
      gas: CONFIGURATION_CALL_GAS,
    });
  }

  for (const draft of options.recipients) {
    const recipientHash = await hashWalletAddress(draft.walletAddress);
    const current = options.snapshot.recipients.find(
      (recipient) => recipient.recipient_hash === recipientHash,
    );
    const desiredCap = nearToYocto(draft.personalCapNear);
    if (!current) {
      calls.push({
        methodName: "add_recipient",
        args: {
          recipient_hash: recipientHash,
          config: {
            name: draft.name.trim(),
            personal_cap: desiredCap,
            active: true,
            preferred_chain: draft.preferredChain,
            preferred_token: draft.preferredToken,
            payment_split: [],
            schedule: draft.schedule,
          },
        },
        gas: CONFIGURATION_CALL_GAS,
      });
      continue;
    }
    if (current.name !== draft.name.trim()) {
      throw new Error(
        `${draft.walletAddress} is already registered as “${current.name}”. Use that exact display name.`,
      );
    }
    if (current.personal_cap !== desiredCap) {
      calls.push({
        methodName: "update_recipient_cap",
        args: { recipient_hash: recipientHash, personal_cap: desiredCap },
        gas: CONFIGURATION_CALL_GAS,
      });
    }
    if (
      current.preferred_chain !== draft.preferredChain ||
      current.preferred_token !== draft.preferredToken ||
      current.payment_split.length > 0
    ) {
      calls.push({
        methodName: "update_recipient_route",
        args: {
          recipient_hash: recipientHash,
          preferred_chain: draft.preferredChain,
          preferred_token: draft.preferredToken,
          payment_split: [],
        },
        gas: CONFIGURATION_CALL_GAS,
      });
    }
    if (current.schedule !== draft.schedule) {
      calls.push({
        methodName: "update_schedule",
        args: { recipient_hash: recipientHash, schedule: draft.schedule },
        gas: CONFIGURATION_CALL_GAS,
      });
    }
    if (!current.active) {
      calls.push({
        methodName: "reinstate_recipient",
        args: { recipient_hash: recipientHash },
        gas: CONFIGURATION_CALL_GAS,
      });
    }
  }

  return calls;
}

export async function configureExistingBusiness(options: {
  wallet: Wallet;
  accountId: string;
  contractId: string;
  agent: string;
  dailyLimitNear: string;
  perPaymentLimitNear: string;
  recipients: RecipientDraft[];
}): Promise<TransactionSubmission[]> {
  const snapshot = await loadContractSnapshot(options.contractId);
  const calls = await buildExistingBusinessCalls({
    snapshot,
    accountId: options.accountId,
    agent: options.agent,
    dailyLimitNear: options.dailyLimitNear,
    perPaymentLimitNear: options.perPaymentLimitNear,
    recipients: options.recipients,
  });
  const submissions: TransactionSubmission[] = [];
  for (let index = 0; index < calls.length; index += CONFIGURATION_CHUNK_SIZE) {
    submissions.push(
      await changeMany(
        options.wallet,
        options.accountId,
        options.contractId,
        calls.slice(index, index + CONFIGURATION_CHUNK_SIZE),
      ),
    );
  }
  return submissions;
}
