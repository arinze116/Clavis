import { FileText, LockKeyhole, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import { AiPayrollReportModal } from "../components/AiPayrollReportModal";
import { AnomalyAlerts } from "../components/AnomalyAlerts";
import { AppShell } from "../components/AppShell";
import { EmergencyControls } from "../components/EmergencyControls";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PaymentHistory } from "../components/PaymentHistory";
import { RecipientTable } from "../components/RecipientTable";
import { RulesPanel } from "../components/RulesPanel";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { TreasuryStatus } from "../components/TreasuryStatus";
import { WalletButton } from "../components/WalletButton";
import { useToast } from "../contexts/ToastContext";
import { useWallet } from "../contexts/WalletContext";
import { useContractState, useOwnerContract } from "../hooks/useContractState";
import type {
  AnomalyEntry,
  Recipient,
  RecipientDraft,
  RecipientUpdateDraft,
} from "../types";
import {
  addRecipient,
  change,
  changeMany,
  runSecurityAudit,
  type ContractCall,
  type TransactionSubmission,
} from "../utils/contract";
import { nearToYocto } from "../utils/format";
import { notifyTransaction } from "../utils/notifications";
import {
  removePayrollRecipient,
  upsertPayrollRecipient,
} from "../utils/payrollPlans";

export default function BusinessDashboard() {
  const { accountId, wallet, loading: walletLoading } = useWallet();
  const ownerContract = useOwnerContract(accountId);
  const contractId = ownerContract.contract?.contract_id ?? null;
  const { data, loading, error, refresh } = useContractState(contractId);
  const { showToast, updateToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [busyRecipient, setBusyRecipient] = useState<string | null>(null);
  const [busyAnomaly, setBusyAnomaly] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  if (walletLoading) {
    return (
      <AppShell>
        <LoadingState label="Opening the owner console" />
      </AppShell>
    );
  }
  if (!accountId || !wallet) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <div className="panel p-10">
            <LockKeyhole className="mx-auto h-9 w-9 text-moss" />
            <h1 className="mt-5 font-display text-4xl">Owner access</h1>
            <p className="mt-3 text-sm leading-6 text-ink/50">
              Connect the owner wallet to find and manage its Clavis contract.
            </p>
            <div className="mt-7 flex justify-center">
              <WalletButton />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }
  if (ownerContract.loading) {
    return (
      <AppShell>
        <LoadingState label="Finding your business contract" />
      </AppShell>
    );
  }
  if (ownerContract.error) {
    return (
      <AppShell>
        <ErrorState message={ownerContract.error} retry={() => void ownerContract.refresh()} />
      </AppShell>
    );
  }
  if (!ownerContract.contract) return <Navigate to="/setup" replace />;
  if (loading) {
    return (
      <AppShell>
        <LoadingState label="Reading your on-chain payroll state" />
      </AppShell>
    );
  }
  if (error || !data) {
    return (
      <AppShell>
        <ErrorState
          message={error ?? "No contract state returned"}
          retry={() => void refresh()}
        />
      </AppShell>
    );
  }
  const activeWallet = wallet;
  const activeAccountId = accountId;
  const snapshot = data;

  async function runTransaction<T extends TransactionSubmission | TransactionSubmission[]>(
    action: () => Promise<T>,
    successMessage: string,
  ): Promise<T> {
    const toastId = showToast({ status: "pending", message: "Transaction submitted" });
    setBusy(true);
    try {
      const result = await action();
      const submissions = Array.isArray(result) ? result : [result];
      const explorerHref = submissions.find((submission) => submission.explorerHref)?.explorerHref;
      updateToast(toastId, {
        status: "success",
        message: `Transaction confirmed ✅ — ${successMessage}`,
        ...(explorerHref ? { explorerHref } : {}),
      });
      await refresh();
      return result;
    } catch (reason) {
      const error =
        reason instanceof Error
          ? reason
          : new Error(typeof reason === "string" ? reason : "Transaction failed");
      updateToast(toastId, {
        status: "error",
        message: `Transaction failed ❌ — ${error.message}`,
      });
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function runPrivatePlanAction(
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<void> {
    const toastId = showToast({
      status: "pending",
      message: "Authorizing private payroll plan",
    });
    setBusy(true);
    try {
      await action();
      updateToast(toastId, { status: "success", message: `${successMessage} ✅` });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Private payroll update failed";
      updateToast(toastId, {
        status: "error",
        message: `Agent configuration failed ❌ — ${message}`,
      });
      throw reason;
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecipient(recipient: Recipient): Promise<void> {
    setBusyRecipient(recipient.recipient_hash);
    try {
      await runTransaction(
        () =>
          change(
            activeWallet,
            activeAccountId,
            snapshot.contractId,
            recipient.active ? "suspend_recipient" : "reinstate_recipient",
            { recipient_hash: recipient.recipient_hash },
          ),
        recipient.active ? `${recipient.name} suspended` : `${recipient.name} reinstated`,
      );
    } finally {
      setBusyRecipient(null);
    }
  }

  async function updateRecipient(
    recipient: Recipient,
    update: RecipientUpdateDraft,
  ): Promise<void> {
    const calls: ContractCall[] = [];
    const nextCap = nearToYocto(update.personalCapNear);
    if (nextCap !== recipient.personal_cap) {
      calls.push({
        methodName: "update_recipient_cap",
        args: { recipient_hash: recipient.recipient_hash, personal_cap: nextCap },
      });
    }
    if (
      update.preferredChain !== recipient.preferred_chain ||
      update.preferredToken !== recipient.preferred_token
    ) {
      calls.push({
        methodName: "update_recipient_route",
        args: {
          recipient_hash: recipient.recipient_hash,
          preferred_chain: update.preferredChain,
          preferred_token: update.preferredToken,
          payment_split: recipient.payment_split,
        },
      });
    }
    if (update.schedule !== recipient.schedule) {
      calls.push({
        methodName: "update_schedule",
        args: { recipient_hash: recipient.recipient_hash, schedule: update.schedule },
      });
    }
    if (update.active !== recipient.active) {
      calls.push({
        methodName: update.active ? "reinstate_recipient" : "suspend_recipient",
        args: { recipient_hash: recipient.recipient_hash },
      });
    }
    const privatePlanChanged =
      update.updatePrivatePlan ||
      nextCap !== recipient.personal_cap ||
      update.preferredChain !== recipient.preferred_chain ||
      update.preferredToken !== recipient.preferred_token;
    if (calls.length === 0 && !privatePlanChanged) return;

    setBusyRecipient(recipient.recipient_hash);
    try {
      if (privatePlanChanged) {
        await runPrivatePlanAction(
          () =>
            upsertPayrollRecipient({
              wallet: activeWallet,
              accountId: activeAccountId,
              contractId: snapshot.contractId,
              expectedRecipientHash: recipient.recipient_hash,
              recipient: {
                name: recipient.name,
                walletAddress: update.walletAddress,
                personalCapNear: update.personalCapNear,
                paymentAmountNear: update.paymentAmountNear,
                destinationAddress: update.destinationAddress,
                preferredChain: update.preferredChain,
                preferredToken: update.preferredToken,
                schedule: update.schedule,
              },
            }),
          `${recipient.name}'s private delivery plan updated`,
        );
      }
      if (calls.length > 0) {
        await runTransaction(
          () => changeMany(activeWallet, activeAccountId, snapshot.contractId, calls),
          `${recipient.name} updated`,
        );
      }
    } finally {
      setBusyRecipient(null);
    }
  }

  async function removeRecipient(recipient: Recipient): Promise<void> {
    setBusyRecipient(recipient.recipient_hash);
    try {
      const submission = await runTransaction(
        () =>
          change(activeWallet, activeAccountId, snapshot.contractId, "remove_recipient", {
            recipient_hash: recipient.recipient_hash,
          }),
        `${recipient.name} removed`,
      );
      await runPrivatePlanAction(
        () =>
          removePayrollRecipient({
            wallet: activeWallet,
            accountId: activeAccountId,
            contractId: snapshot.contractId,
            recipientHash: recipient.recipient_hash,
          }),
        `${recipient.name} removed from the agent plan`,
      );
      void notifyTransaction({
        accountId: activeAccountId,
        receiverId: snapshot.contractId,
        transactionHash: submission.hash,
      });
    } finally {
      setBusyRecipient(null);
    }
  }

  async function dismissAnomaly(anomaly: AnomalyEntry): Promise<void> {
    setBusyAnomaly(anomaly.anomaly_id);
    try {
      await runTransaction(
        () =>
          change(activeWallet, activeAccountId, snapshot.contractId, "dismiss_anomaly", {
            anomaly_id: anomaly.anomaly_id,
          }),
        "Anomaly marked as reviewed",
      );
    } finally {
      setBusyAnomaly(null);
    }
  }

  return (
    <AppShell>
      {data.paused && (
        <div className="border-b border-red-300 bg-red-700 px-4 py-3 text-center text-sm font-semibold text-white" role="alert">
          CONTRACT PAUSED — All payments blocked
        </div>
      )}
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-5 lg:px-10 lg:py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Business console</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              Payroll under control
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-ink/50">
              <span className="font-mono text-xs">{data.contractId}</span> · Policy is enforced
              on-chain while sensitive payroll data stays off the public dashboard.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className="button-primary" onClick={() => setReportOpen(true)}>
              <FileText className="h-4 w-4" /> Generate AI report
            </button>
            <button type="button" className="button-secondary" onClick={() => void refresh()}>
              <RefreshCw className="h-4 w-4" /> Refresh state
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 space-y-6">
            <ErrorBoundary compact>
              <TreasuryStatus
                balance={data.treasuryBalance}
                dailyLimit={data.dailyLimit}
                dailySpent={data.dailySpent}
              />
            </ErrorBoundary>
            <ErrorBoundary compact>
              <RecipientTable
                recipients={data.recipients}
                perPaymentLimit={data.perPaymentLimit}
                busy={busy}
                busyHash={busyRecipient}
                onToggle={toggleRecipient}
                onEdit={updateRecipient}
                onRemove={removeRecipient}
              />
            </ErrorBoundary>
            <ErrorBoundary compact>
              <PaymentHistory entries={data.auditLog} contractId={data.contractId} />
            </ErrorBoundary>
          </div>
          <aside className="min-w-0 space-y-6">
            <ErrorBoundary compact>
              <AnomalyAlerts
                anomalies={data.anomalies}
                recentPayments={data.auditLog}
                writeBusy={busy}
                busyId={busyAnomaly}
                onDismiss={dismissAnomaly}
              />
            </ErrorBoundary>
            <ErrorBoundary compact>
              <RulesPanel
                dailyLimit={data.dailyLimit}
                perPaymentLimit={data.perPaymentLimit}
                agent={data.agent}
                busy={busy}
                onUpdateLimits={async (daily, perPayment) => {
                  await runTransaction(
                    () =>
                      change(wallet, accountId, data.contractId, "update_limits", {
                        daily: nearToYocto(daily),
                        per_payment: nearToYocto(perPayment),
                      }),
                    "Treasury limits updated",
                  );
                }}
                onUpdateAgent={async (nextAgent) => {
                  await runTransaction(
                    () =>
                      change(wallet, accountId, data.contractId, "update_agent", {
                        new_agent: nextAgent,
                      }),
                    "Agent address updated",
                  );
                }}
                onAddRecipient={async (draft: RecipientDraft) => {
                  await runPrivatePlanAction(
                    () =>
                      upsertPayrollRecipient({
                        wallet,
                        accountId,
                        contractId: data.contractId,
                        recipient: draft,
                      }),
                    `${draft.name}'s private delivery plan saved`,
                  );
                  await runTransaction(
                    () => addRecipient(wallet, accountId, data.contractId, draft),
                    `${draft.name} added to payroll`,
                  );
                }}
              />
            </ErrorBoundary>
            <ErrorBoundary compact>
              <EmergencyControls
                contractId={data.contractId}
                paused={data.paused}
                busy={busy}
                onTogglePause={async () => {
                  await runTransaction(
                    () =>
                      change(
                        wallet,
                        accountId,
                        data.contractId,
                        data.paused ? "unpause" : "pause",
                      ),
                    data.paused ? "Contract unpaused" : "Contract paused",
                  );
                }}
                onWithdraw={async () => {
                  await runTransaction(
                    () => change(wallet, accountId, data.contractId, "emergency_withdraw"),
                    "Emergency withdrawal confirmed",
                  );
                }}
                onSecurityAudit={async () => {
                  const submission = await runTransaction(
                    () => runSecurityAudit(wallet, accountId, data.contractId),
                    "Security audit recorded on-chain",
                  );
                  return submission.results;
                }}
              />
            </ErrorBoundary>
          </aside>
        </div>
      </div>

      {reportOpen && (
        <AiPayrollReportModal
          contractId={data.contractId}
          auditEntries={data.auditLog}
          anomalies={data.anomalies}
          onClose={() => setReportOpen(false)}
        />
      )}
    </AppShell>
  );
}
