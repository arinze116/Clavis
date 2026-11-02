import { LockKeyhole, RefreshCw } from "lucide-react";
import { useState } from "react";

import { AnomalyAlerts } from "../components/AnomalyAlerts";
import { AppShell } from "../components/AppShell";
import { EmergencyControls } from "../components/EmergencyControls";
import { PaymentHistory } from "../components/PaymentHistory";
import { RecipientTable } from "../components/RecipientTable";
import { RulesPanel } from "../components/RulesPanel";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { TreasuryStatus } from "../components/TreasuryStatus";
import { WalletButton } from "../components/WalletButton";
import { useWallet } from "../contexts/WalletContext";
import { useContractState } from "../hooks/useContractState";
import type { AnomalyEntry, Recipient, RecipientDraft } from "../types";
import { addRecipient, change } from "../utils/contract";
import { nearToYocto } from "../utils/format";

export default function BusinessDashboard() {
  const { accountId, wallet, loading: walletLoading } = useWallet();
  const { data, loading, error, refresh } = useContractState();
  const [busy, setBusy] = useState(false);
  const [busyRecipient, setBusyRecipient] = useState<string | null>(null);
  const [busyAnomaly, setBusyAnomaly] = useState<number | null>(null);

  if (loading || walletLoading) return <AppShell><LoadingState /></AppShell>;
  if (error || !data) return <AppShell><ErrorState message={error ?? "No contract state returned"} retry={() => void refresh()} /></AppShell>;
  if (!accountId || !wallet) return <AppShell><div className="mx-auto max-w-xl px-5 py-24 text-center"><div className="panel p-10"><LockKeyhole className="mx-auto h-9 w-9 text-moss" /><h1 className="mt-5 font-display text-4xl">Owner access</h1><p className="mt-3 text-sm leading-6 text-ink/50">Connect the owner wallet to manage payroll policy and emergency controls.</p><div className="mt-7"><WalletButton /></div></div></div></AppShell>;
  if (accountId !== data.owner) return <AppShell><div className="mx-auto max-w-xl px-5 py-24 text-center"><div className="panel p-10"><LockKeyhole className="mx-auto h-9 w-9 text-amber-600" /><h1 className="mt-5 font-display text-4xl">Owner wallet required</h1><p className="mt-3 text-sm leading-6 text-ink/50">This dashboard is restricted to <span className="font-mono text-xs">{data.owner}</span>. The public audit remains available to everyone.</p></div></div></AppShell>;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); await refresh(); } finally { setBusy(false); }
  }

  async function toggleRecipient(recipient: Recipient) {
    setBusyRecipient(recipient.recipient_hash);
    try { await change(wallet!, accountId!, recipient.active ? "suspend_recipient" : "reinstate_recipient", { recipient_hash: recipient.recipient_hash }); await refresh(); } finally { setBusyRecipient(null); }
  }

  async function removeRecipient(recipient: Recipient) {
    if (!window.confirm(`Remove ${recipient.name} from the approved recipient list?`)) return;
    setBusyRecipient(recipient.recipient_hash);
    try { await change(wallet!, accountId!, "remove_recipient", { recipient_hash: recipient.recipient_hash }); await refresh(); } finally { setBusyRecipient(null); }
  }

  async function dismissAnomaly(anomaly: AnomalyEntry) {
    setBusyAnomaly(anomaly.anomaly_id);
    try { await change(wallet!, accountId!, "dismiss_anomaly", { anomaly_id: anomaly.anomaly_id }); await refresh(); } finally { setBusyAnomaly(null); }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Business console</p><h1 className="mt-3 font-display text-5xl font-semibold tracking-tight md:text-6xl">Good morning, owner.</h1><p className="mt-3 text-sm text-ink/50">Policy is enforced onchain. Sensitive payroll data stays off the public dashboard.</p></div><button type="button" className="button-secondary" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /> Refresh state</button></div>
        <div className="mt-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"><div className="space-y-6"><TreasuryStatus balance={data.treasuryBalance} dailyLimit={data.dailyLimit} dailySpent={data.dailySpent} /><RecipientTable recipients={data.recipients} busyHash={busyRecipient} onToggle={(recipient) => void toggleRecipient(recipient)} onRemove={(recipient) => void removeRecipient(recipient)} /><PaymentHistory entries={data.auditLog} /></div><aside className="space-y-6"><AnomalyAlerts anomalies={data.anomalies} busyId={busyAnomaly} onDismiss={(anomaly) => void dismissAnomaly(anomaly)} /><RulesPanel dailyLimit={data.dailyLimit} perPaymentLimit={data.perPaymentLimit} agent={data.agent} busy={busy} onUpdateLimits={(daily, perPayment) => run(() => change(wallet, accountId, "update_limits", { daily: nearToYocto(daily), per_payment: nearToYocto(perPayment) }))} onUpdateAgent={(agent) => run(() => change(wallet, accountId, "update_agent", { new_agent: agent.trim() }))} onAddRecipient={(draft: RecipientDraft) => run(() => addRecipient(wallet, accountId, draft))} /><EmergencyControls paused={data.paused} busy={busy} onTogglePause={() => run(() => change(wallet, accountId, data.paused ? "unpause" : "pause"))} onWithdraw={() => run(() => change(wallet, accountId, "emergency_withdraw"))} /></aside></div>
      </div>
    </AppShell>
  );
}
