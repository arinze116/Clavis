import { ArrowLeft, ArrowRight, Check, KeyRound, Plus, Rocket, ShieldCheck, Trash2, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { LoadingState } from "../components/ScreenState";
import { WalletButton } from "../components/WalletButton";
import { useWallet } from "../contexts/WalletContext";
import { useContractState } from "../hooks/useContractState";
import type { RecipientDraft } from "../types";
import { addRecipient, change } from "../utils/contract";
import { nearToYocto } from "../utils/format";

const emptyRecipient: RecipientDraft = { name: "", walletAddress: "", personalCapNear: "", preferredChain: "near", preferredToken: "NEAR", schedule: "Weekly" };
const steps = ["Wallet", "Limits", "Recipients", "Agent", "Review"];

export default function SetupWizard() {
  const navigate = useNavigate();
  const { accountId, wallet, loading: walletLoading } = useWallet();
  const { data, loading } = useContractState();
  const [step, setStep] = useState(0);
  const [dailyLimit, setDailyLimit] = useState("100");
  const [perPaymentLimit, setPerPaymentLimit] = useState("20");
  const [agent, setAgent] = useState("clavis-agent.testnet");
  const [recipients, setRecipients] = useState<RecipientDraft[]>([]);
  const [draft, setDraft] = useState<RecipientDraft>(emptyRecipient);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estimatedPayments = useMemo(() => {
    const daily = Number(dailyLimit); const payment = Number(perPaymentLimit);
    return Number.isFinite(daily / payment) && payment > 0 ? Math.floor(daily / payment) : 0;
  }, [dailyLimit, perPaymentLimit]);

  if (loading || walletLoading) return <AppShell><LoadingState /></AppShell>;
  const ownerMismatch = Boolean(accountId && data && accountId !== data.owner);

  function addDraft() {
    if (!draft.name.trim() || !draft.walletAddress.trim() || !draft.personalCapNear.trim()) return;
    setRecipients((value) => [...value, draft]);
    setDraft(emptyRecipient);
  }

  async function applyConfiguration() {
    if (!wallet || !accountId) return;
    setDeploying(true); setError(null);
    try {
      await change(wallet, accountId, "update_limits", { daily: nearToYocto(dailyLimit), per_payment: nearToYocto(perPaymentLimit) });
      if (agent !== data?.agent) await change(wallet, accountId, "update_agent", { new_agent: agent.trim() });
      for (const recipient of recipients) await addRecipient(wallet, accountId, recipient);
      navigate("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Configuration failed");
    } finally { setDeploying(false); }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1080px] px-5 py-12 lg:px-10 lg:py-16">
        <div className="text-center"><p className="eyebrow">Owner onboarding</p><h1 className="mt-4 font-display text-5xl font-semibold tracking-tight md:text-6xl">Set the boundaries once.</h1><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink/50">This wizard configures the deployed testnet contract. Deployment itself remains a reproducible, owner-signed script so contract code cannot be swapped by the browser.</p></div>
        <div className="mx-auto mt-10 flex max-w-3xl items-center justify-between">{steps.map((label, index) => <div key={label} className="flex flex-1 items-center last:flex-none"><div className="grid justify-items-center gap-2"><span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${index <= step ? "bg-ink text-acid" : "border border-line bg-white text-ink/35"}`}>{index < step ? <Check className="h-4 w-4" /> : index + 1}</span><span className="hidden text-[10px] font-semibold uppercase tracking-wider text-ink/40 sm:block">{label}</span></div>{index < steps.length - 1 && <span className={`mx-2 h-px flex-1 ${index < step ? "bg-ink" : "bg-line"}`} />}</div>)}</div>
        <div className="panel mx-auto mt-9 max-w-3xl p-6 sm:p-9">
          {step === 0 && <div className="text-center"><WalletCards className="mx-auto h-9 w-9 text-moss" /><h2 className="mt-5 font-display text-3xl font-semibold">Connect the owner wallet</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/50">The connected account signs every configuration transaction. Agent keys can never use these methods.</p><div className="mt-7"><WalletButton /></div>{ownerMismatch && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Connected wallet is not the deployed contract owner.</p>}</div>}
          {step === 1 && <div><ShieldCheck className="h-8 w-8 text-moss" /><h2 className="mt-5 font-display text-3xl font-semibold">Set treasury limits</h2><p className="mt-2 text-sm text-ink/50">All values are enforced in yoctoNEAR by the contract.</p><div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-ink/50">Daily limit (NEAR)<input className="field mt-2" inputMode="decimal" value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} /></label><label className="text-xs font-semibold text-ink/50">Per-payment limit (NEAR)<input className="field mt-2" inputMode="decimal" value={perPaymentLimit} onChange={(event) => setPerPaymentLimit(event.target.value)} /></label></div><div className="mt-5 rounded-2xl bg-acid/55 p-4 text-sm">At these limits, no more than <strong>{estimatedPayments} maximum-size payments</strong> can be authorized per day.</div></div>}
          {step === 2 && <div><Plus className="h-8 w-8 text-moss" /><h2 className="mt-5 font-display text-3xl font-semibold">Add approved recipients</h2><p className="mt-2 text-sm text-ink/50">Wallet addresses are hashed in your browser before they reach the contract.</p><div className="mt-6 grid gap-3"><input className="field" placeholder="Display name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /><input className="field font-mono text-xs" placeholder="Wallet address" value={draft.walletAddress} onChange={(event) => setDraft({ ...draft, walletAddress: event.target.value })} /><div className="grid gap-3 sm:grid-cols-3"><input className="field" placeholder="Personal cap" value={draft.personalCapNear} onChange={(event) => setDraft({ ...draft, personalCapNear: event.target.value })} /><select className="field" value={draft.preferredChain} onChange={(event) => { const chain = event.target.value as RecipientDraft["preferredChain"]; setDraft({ ...draft, preferredChain: chain, preferredToken: chain === "near" ? "NEAR" : chain === "ethereum" ? "USDC" : "BUSD" }); }}><option value="near">NEAR</option><option value="ethereum">Ethereum</option><option value="bnb">BNB</option></select><select className="field" value={draft.schedule} onChange={(event) => setDraft({ ...draft, schedule: event.target.value as RecipientDraft["schedule"] })}><option value="Weekly">Weekly</option><option value="Biweekly">Biweekly</option><option value="Milestone">Milestone</option></select></div><button type="button" className="button-secondary" onClick={addDraft} disabled={recipients.length >= 20}><Plus className="h-4 w-4" /> Add to setup</button></div><div className="mt-5 space-y-2">{recipients.map((recipient, index) => <div key={`${recipient.walletAddress}-${index}`} className="flex items-center justify-between rounded-2xl bg-canvas p-3"><div><p className="text-sm font-semibold">{recipient.name}</p><p className="mt-1 text-xs text-ink/40">{recipient.preferredChain} · {recipient.schedule} · {recipient.personalCapNear} NEAR cap</p></div><button type="button" className="grid h-8 w-8 place-items-center rounded-full text-red-600" onClick={() => setRecipients((value) => value.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></button></div>)}</div></div>}
          {step === 3 && <div><KeyRound className="h-8 w-8 text-moss" /><h2 className="mt-5 font-display text-3xl font-semibold">Authorize the payroll agent</h2><p className="mt-2 text-sm leading-6 text-ink/50">Use an account key restricted at protocol level to <span className="font-mono">request_payment</span> on this contract only.</p><label className="mt-7 block text-xs font-semibold text-ink/50">Agent account<input className="field mt-2 font-mono text-xs" value={agent} onChange={(event) => setAgent(event.target.value)} /></label><div className="mt-5 rounded-2xl border border-line p-4 text-xs leading-5 text-ink/50"><strong className="text-ink">Function Call Key safety:</strong> the key cannot transfer funds, deploy code, change policy, or call owner methods—even if stolen.</div></div>}
          {step === 4 && <div><Rocket className="h-8 w-8 text-moss" /><h2 className="mt-5 font-display text-3xl font-semibold">Review and apply</h2><div className="mt-7 divide-y divide-line rounded-2xl border border-line">{[["Owner", accountId ?? "Not connected"], ["Daily limit", `${dailyLimit} NEAR`], ["Per-payment limit", `${perPaymentLimit} NEAR`], ["Recipients", String(recipients.length)], ["Agent", agent]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-6 px-4 py-3 text-sm"><span className="text-ink/45">{label}</span><span className="truncate text-right font-medium">{value}</span></div>)}</div><button type="button" className="button-primary mt-6 w-full" disabled={deploying || !wallet || ownerMismatch} onClick={() => void applyConfiguration()}>{deploying ? "Awaiting wallet signatures…" : "Apply contract configuration"} <ArrowRight className="h-4 w-4" /></button>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}</div>}

          <div className="mt-9 flex items-center justify-between border-t border-line pt-5"><button type="button" className="button-secondary" disabled={step === 0 || deploying} onClick={() => setStep((value) => value - 1)}><ArrowLeft className="h-4 w-4" /> Back</button>{step < 4 && <button type="button" className="button-primary" disabled={(step === 0 && (!accountId || ownerMismatch)) || deploying} onClick={() => setStep((value) => value + 1)}>Continue <ArrowRight className="h-4 w-4" /></button>}</div>
        </div>
      </div>
    </AppShell>
  );
}
