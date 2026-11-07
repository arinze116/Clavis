import { ExternalLink, EyeOff, ShieldCheck } from "lucide-react";

import { AppShell } from "../components/AppShell";
import { PaymentHistory } from "../components/PaymentHistory";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { useWallet } from "../contexts/WalletContext";
import { useAuditState, useOwnerContract } from "../hooks/useContractState";
import { explorerUrl, rootContractId } from "../utils/near";

export default function AuditLog() {
  const { accountId } = useWallet();
  const ownerContract = useOwnerContract(accountId);
  const contractId = ownerContract.contract?.contract_id ?? rootContractId;
  const { data, loading, error, refresh } = useAuditState(contractId, 30_000);

  if (loading && !data) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-5 lg:px-10 lg:py-16">
          <AuditHero />
          <div className="mt-10">
            <LoadingState label="Reading two public contract views" />
          </div>
        </div>
      </AppShell>
    );
  }
  if (!data) {
    return (
      <AppShell>
        <ErrorState
          message={error ?? "No audit state returned"}
          retry={() => void refresh()}
        />
      </AppShell>
    );
  }
  const approved = data.auditLog.filter((entry) => entry.outcome === "Approved").length;
  const rejected = data.auditLog.length - approved;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-5 lg:px-10 lg:py-16">
        <AuditHero />
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ["Total decisions", data.logCount, ""],
            ["Approved in view", approved, "text-emerald-700"],
            ["Rejected in view", rejected, "text-red-700"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="panel p-6">
              <p className="text-xs text-ink/40">{label}</p>
              <p className={`mt-3 font-display text-4xl font-semibold ${color}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between gap-4 text-xs text-ink/45">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Live ledger · refreshes every 30 seconds
          </span>
          {loading && <span>Checking for new decisions…</span>}
        </div>
        {error && (
          <div className="mt-3 flex flex-col gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between" role="status">
            <span>The latest refresh failed. The verified entries below remain available.</span>
            <button type="button" className="font-semibold underline" onClick={() => void refresh()}>
              Retry now
            </button>
          </div>
        )}
        <div className="mt-6">
          <PaymentHistory
            entries={data.auditLog}
            contractId={data.contractId}
            pageSize={20}
            auditEmptyState
          />
        </div>
        <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-line bg-white/65 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-moss" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Verify independently</p>
              <p className="mt-1 truncate font-mono text-[11px] text-ink/40">
                {data.contractId}
              </p>
            </div>
          </div>
          <a
            className="button-secondary"
            href={`${explorerUrl}/address/${data.contractId}`}
            target="_blank"
            rel="noreferrer"
          >
            Open explorer <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </AppShell>
  );
}

function AuditHero() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-end">
      <div>
        <p className="eyebrow">Public verification</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl md:text-7xl">
          Proof without payroll exposure.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-ink/52">
          Every authorization decision is permanent and inspectable. Audit entries omit amounts,
          recipient addresses, names, and destination chains. Standard NEAR transaction inputs and
          public contract configuration remain visible onchain.
        </p>
      </div>
      <div className="rounded-[28px] bg-ink p-7 text-white">
        <EyeOff className="h-6 w-6 text-acid" />
        <p className="mt-7 font-display text-3xl font-semibold">Minimized audit fields</p>
        <p className="mt-3 text-sm leading-6 text-white/45">
          Audit entries omit payroll details. Recipient policy and normal transaction data remain public.
        </p>
      </div>
    </div>
  );
}
