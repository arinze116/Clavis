import { ArrowRight, Bot, Check, EyeOff, Globe2, KeyRound, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { MarketingHeader } from "../components/MarketingHeader";
import { SiteFooter } from "../components/SiteFooter";

const features = [
  { icon: EyeOff, title: "Privacy-minimized", text: "Audit entries omit salary, recipient address, and destination route. Standard transaction metadata remains public." },
  { icon: KeyRound, title: "Agent, constrained", text: "Each payroll contract uses a Function Call key restricted to request_payment. The contract owns every limit." },
  { icon: Globe2, title: "Settlement, evidenced", text: "Native NEAR settles directly. Unsupported cross-chain preferences fail visibly instead of being silently substituted." },
];

const proofBoundary = [
  {
    label: "Proven now",
    title: "Native NEAR settlement",
    text: "The public testnet contract shows direct NEAR authorization and delivery evidence.",
    tone: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200",
  },
  {
    label: "Not claimed",
    title: "Filled cross-chain settlement",
    text: "No public filled solver intent exists yet. Unsupported routes fail before consuming authorization.",
    tone: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  },
  {
    label: "Privacy boundary",
    title: "Minimized, not confidential",
    text: "Audit entries omit payroll details; recipient policy and normal NEAR transaction data remain public.",
    tone: "border-white/15 bg-white/[0.045] text-white/75",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-ink text-white">
      <MarketingHeader landing />

      <main>
        <section className="relative mx-auto grid min-h-[620px] max-w-[1440px] items-center gap-14 px-5 pb-20 pt-10 sm:min-h-[760px] sm:pb-24 sm:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-28">
          <div className="relative z-10 max-w-3xl">
            <h1 className="font-display text-[clamp(3rem,8vw,8rem)] font-medium leading-[0.9] tracking-[-0.045em]">Payroll that keeps its <span className="text-acid">promises.</span></h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/58 lg:text-xl">Give an AI agent enough authority to run payroll—and no authority to break the rules. Privacy-minimized audit evidence. Approved recipients. Verified native NEAR settlement.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Link to="/setup" className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-acid px-6 py-3.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5">Configure Clavis <ArrowRight className="h-4 w-4" /></Link><Link to="/audit" className="inline-flex items-center justify-center rounded-[10px] border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/40">Inspect public audit</Link><Link to="/guide" className="inline-flex items-center justify-center rounded-[10px] border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/40">Read the guide</Link></div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs text-white/45"><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-acid" /> NEAR testnet</span><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-acid" /> Rule-bound agent</span><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-acid" /> Publicly verifiable</span></div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-[580px] sm:block lg:mr-0">
            <div className="relative rotate-[2deg] rounded-[34px] border border-white/15 bg-[#1a1d17] p-5 shadow-2xl sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-acid">Live policy engine</p><p className="mt-2 text-lg font-semibold">Payroll cycle #048</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">Protected</span></div>
              <div className="mt-6 space-y-3">
                {["Agent key authorized", "Recipient commitment approved", "Payment within personal cap", "Daily treasury policy passed", "Destination route registered"].map((rule, index) => <div key={rule} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-4"><span className="grid h-7 w-7 place-items-center rounded-full bg-acid text-ink"><Check className="h-3.5 w-3.5" /></span><span className="flex-1 text-sm text-white/75">{rule}</span><span className="font-mono text-[10px] text-white/30">0{index + 1}</span></div>)}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-acid p-5 text-ink"><ShieldCheck className="h-5 w-5" /><p className="mt-5 font-display text-3xl font-semibold">8/8</p><p className="mt-1 text-xs font-medium opacity-60">Core rules passed</p></div><div className="rounded-2xl border border-white/10 p-5"><EyeOff className="h-5 w-5 text-white/60" /><p className="mt-5 font-display text-3xl font-semibold">••••</p><p className="mt-1 text-xs text-white/40">Omitted from audit entry</p></div></div>
            </div>
          </div>
        </section>

        <section aria-labelledby="proof-boundary-title" className="border-y border-white/10 bg-[#151811] px-5 py-14 lg:px-10">
          <div className="mx-auto max-w-[1360px]">
            <div className="max-w-3xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-acid">Public proof boundary</p>
              <h2 id="proof-boundary-title" className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">What the live demo proves—and what it does not.</h2>
            </div>
            <div className="mt-9 grid gap-4 lg:grid-cols-3">
              {proofBoundary.map((item) => (
                <article key={item.label} className={`rounded-[22px] border p-6 ${item.tone}`}>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-65">{item.label}</p>
                  <h3 className="mt-4 font-display text-2xl font-semibold text-current">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 opacity-70">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="bg-canvas px-5 py-24 text-ink lg:px-10 lg:py-32">
          <div className="mx-auto max-w-[1360px]">
            <div className="max-w-3xl"><p className="eyebrow">Trust less. Enforce more.</p><h2 className="mt-5 font-display text-5xl leading-[0.98] tracking-tight md:text-7xl">Your agent can run payroll. It can’t run away with it.</h2></div>
            <div className="mt-16 grid gap-5 md:grid-cols-3">{features.map(({ icon: Icon, title, text }, index) => <article key={title} className="panel min-h-[310px] p-7 lg:p-9"><div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-acid"><Icon className="h-5 w-5" /></span><span className="font-mono text-xs text-ink/25">0{index + 1}</span></div><h3 className="mt-20 font-display text-3xl font-semibold">{title}</h3><p className="mt-4 text-sm leading-6 text-ink/50">{text}</p></article>)}</div>
          </div>
        </section>

        <section id="architecture" className="bg-acid px-5 py-24 text-ink lg:px-10 lg:py-32">
          <div className="mx-auto grid max-w-[1360px] gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]">One autonomous loop</p><h2 className="mt-5 font-display text-5xl leading-none tracking-tight md:text-7xl">Configure once. Let policy do the rest.</h2><p className="mt-7 max-w-lg text-base leading-7 text-ink/65">The agent watches schedules and proposes payments. The contract independently decides. The public demo proves native NEAR delivery; filled solver intents will only be claimed when a verifiable relay reference exists.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">{[{ icon: Bot, n: "01", t: "Agent proposes", d: "The scheduler finds due recipients from the off-chain payroll plan." }, { icon: ShieldCheck, n: "02", t: "Contract decides", d: "Every cap, route, schedule, and daily limit is enforced onchain." }, { icon: EyeOff, n: "03", t: "Audit minimizes", d: "Public audit entries omit amounts and recipient identifiers; transaction metadata remains observable." }, { icon: Globe2, n: "04", t: "Settlement proves", d: "A delivery record must show the actual route; unsupported cross-chain preferences fail without substitution." }].map(({ icon: Icon, n, t, d }) => <article key={n} className="rounded-[26px] bg-ink p-7 text-white"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-acid" /><span className="font-mono text-xs text-white/30">{n}</span></div><h3 className="mt-14 font-display text-2xl font-semibold">{t}</h3><p className="mt-3 text-sm leading-6 text-white/45">{d}</p></article>)}</div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
