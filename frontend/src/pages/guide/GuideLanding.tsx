import { ArrowRight, BriefcaseBusiness, Code2, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { AppShell } from "../../components/AppShell";

const guides = [
  {
    to: "/guide/business",
    label: "I’m a business owner",
    description: "Deploy, fund, configure, monitor, and security-test an isolated payroll contract.",
    detail: "7 steps",
    icon: BriefcaseBusiness,
  },
  {
    to: "/guide/worker",
    label: "I’m a worker",
    description:
      "Join a payroll roster, share a testnet wallet, receive notifications, and review employer-wide decisions.",
    detail: "5 steps",
    icon: UserRound,
  },
  {
    to: "/guide/developer",
    label: "I’m a developer",
    description: "Understand the contracts, scheduler, frontend, NEAR primitives, and local workflow.",
    detail: "Architecture + reference",
    icon: Code2,
  },
];

export default function GuideLanding() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-5 lg:px-10 lg:py-20">
        <header className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="flex items-center gap-3 text-moss">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <p className="font-mono text-xs font-medium">Clavis field guide</p>
            </div>
            <h1 className="mt-5 max-w-4xl font-display text-5xl font-semibold leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
              How Clavis works
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-ink/60 sm:text-lg sm:leading-8">
              Clavis gives an autonomous payroll agent a narrow job while the NEAR contract
              remains the final authority. Choose your role for a practical walkthrough from
              wallet connection to independently verified policy decisions.
            </p>
          </div>
          <div className="rounded-2xl bg-ink p-6 text-white">
            <p className="font-mono text-xs text-acid">One operating model</p>
            <p className="mt-4 font-display text-3xl font-semibold leading-tight">
              The agent proposes. The contract decides.
            </p>
            <p className="mt-4 text-sm leading-6 text-white/50">
              Access-controlled payroll context stays outside the public audit; rule outcomes remain
              inspectable on NEAR testnet.
            </p>
          </div>
        </header>

        <section className="mt-14" aria-labelledby="choose-guide-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="choose-guide-title" className="font-display text-3xl font-semibold text-ink">
                Choose your path
              </h2>
              <p className="mt-2 text-sm text-ink/50">Each guide keeps your place as you move between steps.</p>
            </div>
            <Link className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-moss underline decoration-moss/25 underline-offset-4" to="/setup">
              Skip to setup
            </Link>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {guides.map(({ to, label, description, detail, icon: Icon }, index) => (
              <Link
                key={to}
                to={to}
                className="group flex min-h-[260px] flex-col rounded-2xl border border-line bg-white/75 p-6 shadow-lift transition-[border-color,transform] duration-150 hover:-translate-y-1 hover:border-ink/25 motion-reduce:transform-none"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-acid">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs text-ink/30">0{index + 1}</span>
                </div>
                <h3 className="mt-10 font-display text-3xl font-semibold leading-tight text-ink">
                  {label}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-ink/55">{description}</p>
                <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-xs text-ink/40">{detail}</span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-moss">
                    Open guide
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
