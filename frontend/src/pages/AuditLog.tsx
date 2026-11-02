import { ExternalLink, EyeOff, ShieldCheck } from "lucide-react";

import { AppShell } from "../components/AppShell";
import { PaymentHistory } from "../components/PaymentHistory";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { useContractState } from "../hooks/useContractState";
import { contractId } from "../utils/near";

export default function AuditLog() {
  const { data, loading, error, refresh } = useContractState();
  if (loading) return <AppShell><LoadingState label="Reading the public audit ledger" /></AppShell>;
  if (error || !data) return <AppShell><ErrorState message={error ?? "No audit state returned"} retry={() => void refresh()} /></AppShell>;
  const approved = data.auditLog.filter((entry) => entry.outcome === "Approved").length;
  const rejected = data.auditLog.length - approved;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-5 py-12 lg:px-10 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-end"><div><p className="eyebrow">Public verification</p><h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-none tracking-tight md:text-7xl">Proof without payroll exposure.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-ink/52">Every authorization decision is permanent and inspectable. Amounts, recipient addresses, names, and destination chains are intentionally absent from this log.</p></div><div className="rounded-[28px] bg-ink p-7 text-white"><EyeOff className="h-6 w-6 text-acid" /><p className="mt-7 font-display text-3xl font-semibold">Zero salary data</p><p className="mt-3 text-sm leading-6 text-white/45">The audit proves policy outcomes—not private compensation.</p></div></div>
        <div className="mt-12 grid gap-4 sm:grid-cols-3"><div className="panel p-6"><p className="text-xs text-ink/40">Total decisions</p><p className="mt-3 font-display text-4xl font-semibold">{data.logCount}</p></div><div className="panel p-6"><p className="text-xs text-ink/40">Approved in view</p><p className="mt-3 font-display text-4xl font-semibold text-emerald-700">{approved}</p></div><div className="panel p-6"><p className="text-xs text-ink/40">Rejected in view</p><p className="mt-3 font-display text-4xl font-semibold text-red-700">{rejected}</p></div></div>
        <div className="mt-6"><PaymentHistory entries={data.auditLog} pageSize={20} /></div>
        <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-line bg-white/65 p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-moss" /><div><p className="text-sm font-semibold">Verify independently</p><p className="mt-1 font-mono text-[11px] text-ink/40">{contractId}</p></div></div><a className="button-secondary" href="https://testnet.nearblocks.io/address/clavis.testnet" target="_blank" rel="noreferrer">Open explorer <ExternalLink className="h-4 w-4" /></a></div>
      </div>
    </AppShell>
  );
}
