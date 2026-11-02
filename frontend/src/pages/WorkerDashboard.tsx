import { Eye, LockKeyhole, Route, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { ChainPreference } from "../components/ChainPreference";
import { CountdownTimer } from "../components/CountdownTimer";
import { PaymentSplit } from "../components/PaymentSplit";
import { LoadingState } from "../components/ScreenState";
import { WalletButton } from "../components/WalletButton";
import { useWallet } from "../contexts/WalletContext";
import type { Recipient } from "../types";
import { hashWalletAddress, view } from "../utils/contract";
import { chainLabel, formatTimestamp } from "../utils/format";

export default function WorkerDashboard() {
  const { accountId, loading: walletLoading } = useWallet();
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) {
      setRecipient(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void hashWalletAddress(accountId)
      .then((hash) => view<Recipient | null>("get_recipient", { recipient_hash: hash }))
      .then((value) => { if (active) setRecipient(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load worker profile"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId]);

  if (walletLoading || loading) return <AppShell><LoadingState label="Opening your private payroll view" /></AppShell>;
  if (!accountId) return <AppShell><div className="mx-auto max-w-xl px-5 py-24 text-center"><div className="panel p-10"><WalletCards className="mx-auto h-9 w-9 text-moss" /><h1 className="mt-5 font-display text-4xl">Your payroll, your view</h1><p className="mt-3 text-sm leading-6 text-ink/50">Connect the NEAR account registered by your employer. The address is hashed locally before lookup.</p><div className="mt-7"><WalletButton /></div></div></div></AppShell>;
  if (error) return <AppShell><div className="mx-auto max-w-xl px-5 py-24 text-center"><div className="panel p-10"><LockKeyhole className="mx-auto h-9 w-9 text-red-600" /><h1 className="mt-5 font-display text-4xl">Private view unavailable</h1><p className="mt-3 text-sm text-ink/50">{error}</p></div></div></AppShell>;
  if (!recipient) return <AppShell><div className="mx-auto max-w-xl px-5 py-24 text-center"><div className="panel p-10"><LockKeyhole className="mx-auto h-9 w-9 text-amber-600" /><h1 className="mt-5 font-display text-4xl">No payroll profile found</h1><p className="mt-3 text-sm leading-6 text-ink/50">Your wallet is not yet on a payroll roster. Share your NEAR wallet address with your employer and ask them to add you via their Clavis dashboard.</p><Link to="/audit" className="button-secondary mt-7">View public audit</Link></div></div></AppShell>;

  const splits = recipient.payment_split.length ? recipient.payment_split : [{ chain: recipient.preferred_chain, token: recipient.preferred_token, percentage: 100 }];
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-5 py-12 lg:px-10 lg:py-16">
        <div><p className="eyebrow">Worker portal</p><h1 className="mt-3 font-display text-5xl font-semibold tracking-tight md:text-6xl">Hello, {recipient.name}.</h1><p className="mt-3 text-sm text-ink/50">Only your registered payroll profile is resolved from this wallet.</p></div>
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[30px] bg-ink p-7 text-white lg:p-9"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-acid">Next payment</p><h2 className="mt-3 font-display text-3xl font-semibold">{recipient.schedule} cycle</h2></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${recipient.active ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{recipient.active ? "Active" : "Suspended"}</span></div><div className="mt-8 [&>div>div]:bg-white/10"><CountdownTimer targetTimestamp={recipient.next_payment_at} /></div><div className="mt-8 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2"><div><p className="text-xs text-white/35">Primary route</p><p className="mt-2 text-sm font-semibold">{chainLabel(recipient.preferred_chain)} · {recipient.preferred_token}</p></div><div><p className="text-xs text-white/35">Last authorization</p><p className="mt-2 text-sm font-semibold">{recipient.last_paid ? formatTimestamp(recipient.last_paid) : "Not paid yet"}</p></div></div></section>
            <section className="panel p-6 lg:p-8"><div className="flex items-center justify-between"><div><p className="eyebrow">Private earnings</p><h2 className="mt-2 font-display text-2xl font-semibold">Your delivery history</h2></div><Eye className="h-5 w-5 text-moss" /></div><div className="mt-7 rounded-2xl border border-dashed border-line bg-canvas/50 p-7 text-center"><LockKeyhole className="mx-auto h-6 w-6 text-ink/35" /><p className="mt-3 text-sm font-semibold">Protected by the confidential executor</p><p className="mt-2 text-xs leading-5 text-ink/45">Amounts and destination receipts are returned only after wallet-signature verification by the private data service. They never come from the public audit RPC.</p></div></section>
          </div>
          <aside className="space-y-6"><ChainPreference recipient={recipient} /><PaymentSplit splits={splits} /><div className="rounded-[28px] bg-acid p-7"><Route className="h-6 w-6" /><h3 className="mt-8 font-display text-3xl font-semibold">One policy. Multiple chains.</h3><p className="mt-3 text-sm leading-6 text-ink/60">Your employer authorizes one private payment; Clavis handles each registered route.</p></div></aside>
        </div>
      </div>
    </AppShell>
  );
}
