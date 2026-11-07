import {
  Activity,
  Bot,
  ExternalLink,
  FileText,
  Globe2,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

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
  ContractSnapshot,
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
import { chainLabel, formatNear, nearToYocto } from "../utils/format";
import { explorerUrl, rootContractId } from "../utils/near";
import { notifyTransaction } from "../utils/notifications";
import {
  removePayrollRecipient,
  upsertPayrollRecipient,
} from "../utils/payrollPlans";

export default function BusinessDashboard() {
  const { accountId, wallet, loading: walletLoading } = useWallet();
  const ownerContract = useOwnerContract(accountId);
  const contractId = ownerContract.contract?.contract_id ?? rootContractId;
  const { data, loading, error, refresh } = useContractState(contractId, 10_000);
  const { showToast, updateToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [busyRecipient, setBusyRecipient] = useState<string | null>(null);
  const [busyAnomaly, setBusyAnomaly] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  if (walletLoading && !data) {
    return <PublicDashboardLoading />;
  }
  if (!accountId || !wallet) {
    if (loading && !data) {
      return <PublicDashboardLoading />;
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
    return (
      <PublicDashboard snapshot={data} loading={loading} refresh={refresh} />
    );
  }
  if (ownerContract.loading) {
    return data
      ? <PublicDashboard snapshot={data} loading={loading} refresh={refresh} />
      : <PublicDashboardLoading />;
  }
  if (ownerContract.error) {
    return data
      ? <PublicDashboard snapshot={data} loading={loading} refresh={refresh} />
      : (
          <AppShell>
            <ErrorState message={ownerContract.error} retry={() => void ownerContract.refresh()} />
          </AppShell>
        );
  }
  if (!ownerContract.contract) {
    if (loading && !data) return <PublicDashboardLoading />;
    if (error || !data) {
      return (
        <AppShell>
          <ErrorState message={error ?? "No public contract state returned"} retry={() => void refresh()} />
        </AppShell>
      );
    }
    return <PublicDashboard snapshot={data} loading={loading} refresh={refresh} />;
  }
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
              <FileText className="h-4 w-4" /> Generate verified report
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
                contractId={data.contractId}
                anomalies={data.anomalies}
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
          onClose={() => setReportOpen(false)}
        />
      )}
    </AppShell>
  );
}

function PublicDashboard({
  snapshot,
  loading,
  refresh,
}: {
  snapshot: ContractSnapshot;
  loading: boolean;
  refresh: () => Promise<void>;
}) {
  const activeAnomalies = snapshot.anomalies.filter((anomaly) => !anomaly.reviewed);
  const activeRecipients = snapshot.recipients.filter((recipient) => recipient.active).length;

  return (
    <AppShell>
      {snapshot.paused && (
        <div
          className="border-b border-red-300 bg-red-700 px-4 py-3 text-center text-sm font-semibold text-white"
          role="alert"
        >
          CONTRACT PAUSED — All payments blocked
        </div>
      )}
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-5 lg:px-10 lg:py-14">
        <div className="rounded-[28px] border border-moss/20 bg-[#eef3e9] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="relative mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-acid">
                <Activity className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#eef3e9] bg-emerald-500" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">Live contract evidence</p>
                  <span className="rounded-full border border-moss/20 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-moss">
                    Read only
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/55">
                  This console reads <span className="font-mono text-xs">{snapshot.contractId}</span> directly
                  from NEAR testnet. Connect the owner wallet only when you need to change policy.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={`${explorerUrl}/address/${snapshot.contractId}`}
                target="_blank"
                rel="noreferrer"
                className="button-secondary"
              >
                Open on NearBlocks <ExternalLink className="h-4 w-4" />
              </a>
              <WalletButton />
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Public business console</p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              Inspect the payroll system before connecting.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/52">
              Treasury, roster policy, anomalies, and authorization decisions are live contract state.
              Salary amounts and wallet addresses are not stored in audit entries; standard NEAR
              transaction inputs and public contract configuration remain visible onchain.
            </p>
          </div>
          <button
            type="button"
            className="button-secondary shrink-0"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing" : "Refresh state"}
          </button>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <EvidenceMetric icon={Users} label="Active recipients" value={`${activeRecipients}/${snapshot.recipients.length}`} />
          <EvidenceMetric icon={ShieldCheck} label="Recorded decisions" value={String(snapshot.logCount)} />
          <EvidenceMetric icon={Activity} label="Open anomalies" value={String(activeAnomalies.length)} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 space-y-6">
            <ErrorBoundary compact>
              <TreasuryStatus
                balance={snapshot.treasuryBalance}
                dailyLimit={snapshot.dailyLimit}
                dailySpent={snapshot.dailySpent}
              />
            </ErrorBoundary>
            <PublicRoster snapshot={snapshot} />
            <ErrorBoundary compact>
              <PaymentHistory entries={snapshot.auditLog} contractId={snapshot.contractId} />
            </ErrorBoundary>
          </div>
          <aside className="min-w-0 space-y-6">
            <PublicPolicy snapshot={snapshot} />
            <PublicAnomalies anomalies={activeAnomalies} />
            <PublicSettlementEvidence />
            <section className="rounded-[22px] bg-ink p-6 text-white lg:p-8">
              <Bot className="h-5 w-5 text-acid" aria-hidden="true" />
              <h2 className="mt-8 font-display text-2xl font-semibold">Owner controls stay locked.</h2>
              <p className="mt-3 text-sm leading-6 text-white/50">
                Editing recipients, limits, agent access, pause state, and withdrawals requires the
                contract owner to connect and sign. Public visitors can verify state without gaining
                mutation access.
              </p>
              <div className="mt-6">
                <WalletButton />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function PublicDashboardLoading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-5 lg:px-10 lg:py-14">
        <div className="rounded-[28px] border border-moss/20 bg-[#eef3e9] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-acid">
                <Activity className="h-5 w-5 animate-pulse" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Syncing live contract evidence</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/55">
                  The public console is reading <span className="font-mono text-xs">{rootContractId}</span>
                  {" "}from NEAR testnet. You can inspect the product and evidence without a wallet.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={`${explorerUrl}/address/${rootContractId}`}
                target="_blank"
                rel="noreferrer"
                className="button-secondary"
              >
                Open on NearBlocks <ExternalLink className="h-4 w-4" />
              </a>
              <WalletButton />
            </div>
          </div>
        </div>

        <div className="mt-10">
          <p className="eyebrow">Public business console</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Inspect the payroll system before connecting.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/52">
            Live treasury, roster policy, anomalies, and authorization decisions are loading now.
            Owner mutations remain locked behind a signed wallet transaction.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Loading live contract metrics">
          {["Active recipients", "Recorded decisions", "Open anomalies"].map((label) => (
            <div key={label} className="panel p-5">
              <p className="text-xs text-ink/42">{label}</p>
              <div className="mt-3 h-9 w-20 animate-pulse rounded-lg bg-ink/10" />
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <PublicSettlementEvidence />
          <section className="panel p-6 lg:p-8">
            <ShieldCheck className="h-5 w-5 text-moss" aria-hidden="true" />
            <h2 className="mt-6 font-display text-2xl font-semibold">Security evidence is already available.</h2>
            <p className="mt-3 text-sm leading-6 text-ink/52">
              Review the source-linked threat model and CI test evidence while the live contract
              snapshot finishes loading.
            </p>
            <Link className="button-secondary mt-5" to="/security">Open security evidence</Link>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function EvidenceMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="panel flex items-center justify-between gap-4 p-5">
      <div>
        <p className="text-xs text-ink/42">{label}</p>
        <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
      </div>
      <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-canvas text-moss">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    </div>
  );
}

function PublicRoster({ snapshot }: { snapshot: ContractSnapshot }) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-5 sm:px-6 lg:px-8">
        <div>
          <p className="eyebrow">Onchain roster policy</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Approved recipients</h2>
        </div>
        <span className="font-mono text-xs text-ink/40">{snapshot.recipients.length}/20</span>
      </div>
      <div className="divide-y divide-line">
        {snapshot.recipients.map((recipient) => (
          <div
            key={recipient.recipient_hash}
            className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_120px_130px_100px] sm:items-center sm:px-6 lg:px-8"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-ink text-xs font-semibold text-acid">
                {recipient.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{recipient.name}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-ink/35">
                  {recipient.recipient_hash.slice(0, 12)}…
                </p>
              </div>
            </div>
            <p className="text-xs text-ink/52">{recipient.schedule}</p>
            <p className="text-xs text-ink/52">
              {chainLabel(recipient.preferred_chain)} · {recipient.preferred_token}
            </p>
            <span
              className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                recipient.active
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-stone-100 text-stone-500"
              }`}
            >
              {recipient.active ? "Active" : "Suspended"}
            </span>
          </div>
        ))}
        {snapshot.recipients.length === 0 && (
          <p className="px-8 py-12 text-center text-sm text-ink/45">No recipients configured</p>
        )}
      </div>
    </section>
  );
}

function PublicPolicy({ snapshot }: { snapshot: ContractSnapshot }) {
  const rows: Array<[string, string]> = [
    ["Daily limit", formatNear(snapshot.dailyLimit)],
    ["Per payment", formatNear(snapshot.perPaymentLimit)],
    ["Authorized agent", snapshot.agent],
    ["Contract owner", snapshot.owner],
  ];
  return (
    <section className="panel p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Enforced policy</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Contract controls</h2>
        </div>
        <ShieldCheck className="h-5 w-5 text-moss" aria-hidden="true" />
      </div>
      <dl className="mt-6 divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[110px_1fr] sm:gap-4">
            <dt className="text-xs text-ink/42">{label}</dt>
            <dd className={`break-all text-xs text-ink/70 ${label.includes("agent") || label.includes("owner") ? "font-mono" : "font-semibold"}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PublicAnomalies({ anomalies }: { anomalies: AnomalyEntry[] }) {
  return (
    <section className="panel p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Agent watch</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Open anomalies</h2>
        </div>
        <Activity className="h-5 w-5 text-moss" aria-hidden="true" />
      </div>
      <div className="mt-6 space-y-3">
        {anomalies.slice().reverse().slice(0, 3).map((anomaly) => (
          <article key={anomaly.anomaly_id} className="rounded-[14px] border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{anomaly.anomaly_type.replaceAll("_", " ")}</p>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {anomaly.severity}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-ink/55">{anomaly.description}</p>
          </article>
        ))}
        {anomalies.length === 0 && (
          <div className="rounded-[14px] border border-dashed border-line px-4 py-8 text-center">
            <ShieldCheck className="mx-auto h-5 w-5 text-emerald-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">No active anomalies</p>
            <p className="mt-1 text-xs text-ink/45">The latest contract state has no unresolved alerts.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function PublicSettlementEvidence() {
  return (
    <section className="panel p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Settlement evidence</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">What the demo proves</h2>
        </div>
        <Globe2 className="h-5 w-5 text-moss" aria-hidden="true" />
      </div>
      <dl className="mt-6 grid gap-3 text-xs leading-5">
        <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-4">
          <dt className="font-semibold text-emerald-900">Native NEAR</dt>
          <dd className="mt-1 text-emerald-900/70">Direct testnet delivery is supported for NEAR routes.</dd>
        </div>
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-4">
          <dt className="font-semibold text-amber-900">Cross-chain</dt>
          <dd className="mt-1 text-amber-900/70">
            No filled solver intent is published for this demo. Unsupported routes fail visibly;
            they are never replaced with NEAR and called cross-chain.
          </dd>
        </div>
      </dl>
      <Link className="mt-4 inline-flex text-xs font-semibold text-moss underline" to="/security">
        Review evidence and limitations
      </Link>
    </section>
  );
}
