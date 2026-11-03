import { LockKeyhole, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";

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
import type { AnomalyEntry, Recipient, RecipientDraft } from "../types";
import { addRecipient, change, type TransactionSubmission } from "../utils/contract";
import { nearToYocto } from "../utils/format";

export default function BusinessDashboard() {
  const { accountId, wallet, loading: walletLoading } = useWallet();
  const ownerContract = useOwnerContract(accountId);
  const contractId = ownerContract.contract?.contract_id ?? null;
  const { data, loading, showLoading, error, refresh } = useContractState(contractId);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [busyRecipient, setBusyRecipient] = useState<string | null>(null);
  const [busyAnomaly, setBusyAnomaly] = useState<number | null>(null);

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
        <ErrorState
          message={ownerContract.error}
          retry={() => void ownerContract.refresh()}
        />
      </AppShell>
    );
  }
  if (!ownerContract.contract) return <Navigate to="/setup" replace />;
  if (loading && !showLoading) return <AppShell><div className="min-h-[55vh]" /></AppShell>;
  if (loading) {
    return (
      <AppShell>
        <LoadingState label="Reading your onchain payroll state" />
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

  async function run(action: () => Promise<TransactionSubmission | TransactionSubmission[]>) {
    setBusy(true);
    try {
      const result = await action();
      const submissions = Array.isArray(result) ? result : [result];
      for (const submission of submissions) {
        showToast({
          message: "Transaction submitted · View on explorer",
          explorerHref: submission.explorerHref,
        });
      }
      await refresh();
    } catch (reason) {
      showToast({
        message: reason instanceof Error ? reason.message : "Transaction failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecipient(recipient: Recipient) {
    setBusyRecipient(recipient.recipient_hash);
    try {
      const submission = await change(
        wallet!,
        accountId!,
        data!.contractId,
        recipient.active ? "suspend_recipient" : "reinstate_recipient",
        { recipient_hash: recipient.recipient_hash },
      );
      showToast({
        message: "Transaction submitted · View on explorer",
        explorerHref: submission.explorerHref,
      });
      await refresh();
    } catch (reason) {
      showToast({ message: reason instanceof Error ? reason.message : "Transaction failed" });
    } finally {
      setBusyRecipient(null);
    }
  }

  async function removeRecipient(recipient: Recipient) {
    if (!window.confirm(`Remove ${recipient.name} from the approved recipient list?`)) return;
    setBusyRecipient(recipient.recipient_hash);
    try {
      const submission = await change(wallet!, accountId!, data!.contractId, "remove_recipient", {
        recipient_hash: recipient.recipient_hash,
      });
      showToast({
        message: "Transaction submitted · View on explorer",
        explorerHref: submission.explorerHref,
      });
      await refresh();
    } catch (reason) {
      showToast({ message: reason instanceof Error ? reason.message : "Transaction failed" });
    } finally {
      setBusyRecipient(null);
    }
  }

  async function dismissAnomaly(anomaly: AnomalyEntry) {
    setBusyAnomaly(anomaly.anomaly_id);
    try {
      const submission = await change(wallet!, accountId!, data!.contractId, "dismiss_anomaly", {
        anomaly_id: anomaly.anomaly_id,
      });
      showToast({
        message: "Transaction submitted · View on explorer",
        explorerHref: submission.explorerHref,
      });
      await refresh();
    } catch (reason) {
      showToast({ message: reason instanceof Error ? reason.message : "Transaction failed" });
    } finally {
      setBusyAnomaly(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-5 lg:px-10 lg:py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Business console</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              Payroll under control.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-ink/50">
              <span className="font-mono text-xs">{data.contractId}</span> · Policy is
              enforced onchain while sensitive payroll data stays off the public dashboard.
            </p>
          </div>
          <button type="button" className="button-secondary" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" /> Refresh state
          </button>
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
                busyHash={busyRecipient}
                onToggle={(recipient) => void toggleRecipient(recipient)}
                onRemove={(recipient) => void removeRecipient(recipient)}
              />
            </ErrorBoundary>
            <ErrorBoundary compact>
              <PaymentHistory
                entries={data.auditLog}
                contractId={data.contractId}
              />
            </ErrorBoundary>
          </div>
          <aside className="min-w-0 space-y-6">
            <ErrorBoundary compact>
              <AnomalyAlerts
                anomalies={data.anomalies}
                busyId={busyAnomaly}
                onDismiss={(anomaly) => void dismissAnomaly(anomaly)}
              />
            </ErrorBoundary>
            <ErrorBoundary compact>
              <RulesPanel
                dailyLimit={data.dailyLimit}
                perPaymentLimit={data.perPaymentLimit}
                agent={data.agent}
                busy={busy}
                onUpdateLimits={(daily, perPayment) =>
                  run(() =>
                    change(wallet, accountId, data.contractId, "update_limits", {
                      daily: nearToYocto(daily),
                      per_payment: nearToYocto(perPayment),
                    }),
                  )
                }
                onUpdateAgent={(nextAgent) =>
                  run(() =>
                    change(wallet, accountId, data.contractId, "update_agent", {
                      new_agent: nextAgent.trim(),
                    }),
                  )
                }
                onAddRecipient={(draft: RecipientDraft) =>
                  run(() => addRecipient(wallet, accountId, data.contractId, draft))
                }
              />
            </ErrorBoundary>
            <ErrorBoundary compact>
              <EmergencyControls
                paused={data.paused}
                busy={busy}
                onTogglePause={() =>
                  run(() =>
                    change(
                      wallet,
                      accountId,
                      data.contractId,
                      data.paused ? "unpause" : "pause",
                    ),
                  )
                }
                onWithdraw={() =>
                  run(() =>
                    change(wallet, accountId, data.contractId, "emergency_withdraw"),
                  )
                }
              />
            </ErrorBoundary>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
