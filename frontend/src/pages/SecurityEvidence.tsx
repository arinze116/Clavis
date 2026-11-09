import {
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  GitCommitHorizontal,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { securityEvidence } from "../data/securityEvidence.generated";

interface SecurityEvidenceCase {
  id: string;
  category: string;
  threat: string;
  protection: string;
  source: string;
  test: string;
  line: number;
  source_url: string;
}

const evidenceCases: readonly SecurityEvidenceCase[] = securityEvidence.cases;
const evidenceStatus: string = securityEvidence.verification.status;
const evidenceTreeState: string = securityEvidence.verification.tree_state;
const evidenceRunUrl: string = securityEvidence.verification.run_url;
const evidenceUrl = evidenceRunUrl || securityEvidence.verification.workflow_url;
const verificationFailed = evidenceStatus === "failed";
const verificationPassed = evidenceStatus === "passed";
const statusLabel =
  evidenceStatus === "passed"
    ? securityEvidence.verification.run_url
      ? "CI suites passed"
      : "Local suites passed"
    : evidenceStatus === "failed"
      ? "Verification failed"
      : "Source mapped";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function SecurityEvidence() {
  const shortCommit = securityEvidence.verification.commit.slice(0, 7);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-5 lg:px-10 lg:py-16">
        <section className="overflow-hidden rounded-[32px] bg-ink p-7 text-white sm:p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-acid">
                Reproducible security evidence
              </p>
              <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-[0.96] tracking-tight sm:text-6xl lg:text-7xl">
                Tests first. Claims second.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/58">
                Every case below links a concrete threat to the deterministic Rust or agent
                test that enforces it. GitHub Actions runs those suites before publishing a
                commit-specific evidence artifact.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-acid px-5 py-3 text-sm font-bold text-ink"
                  href={evidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {evidenceRunUrl ? "Open CI run" : "Open verification workflow"}{" "}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40"
                  href="https://github.com/arinze116/Clavis/blob/main/docs/THREAT-MODEL.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read threat model <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <EvidenceMetric label="Mapped threats" value={securityEvidence.summary.mapped_threats} />
              <EvidenceMetric label="Categories" value={securityEvidence.summary.categories} />
              <EvidenceMetric label="Rust tests" value={securityEvidence.summary.repository_tests.rust} />
              <EvidenceMetric label="Agent tests" value={securityEvidence.summary.repository_tests.agent} />
              <EvidenceMetric label="API tests" value={securityEvidence.summary.repository_tests.api} />
              <EvidenceMetric label="Browser paths" value={securityEvidence.summary.repository_tests.browser} />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="panel flex min-w-0 items-center gap-4 p-5">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] ${
                verificationFailed
                  ? "bg-red-50 text-red-700"
                  : verificationPassed
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
              }`}
            >
              {verificationFailed
                ? <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                : verificationPassed
                  ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  : <FileCheck2 className="h-5 w-5" aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{statusLabel}</p>
              <p className="mt-1 truncate text-xs text-ink/45">
                Generated {formatDate(securityEvidence.verification.generated_at)} UTC
              </p>
            </div>
          </div>
          <a
            className="panel flex items-center gap-3 p-5 transition hover:border-ink/20"
            href={`https://github.com/arinze116/Clavis/commit/${securityEvidence.verification.commit}`}
            target="_blank"
            rel="noreferrer"
          >
            <GitCommitHorizontal className="h-5 w-5 text-moss" aria-hidden="true" />
            <span>
              <span className="block text-xs text-ink/40">
                {evidenceTreeState === "clean" ? "Evidence commit" : "Base commit"}
              </span>
              <span className="mt-1 block font-mono text-sm font-semibold">{shortCommit}</span>
            </span>
          </a>
        </section>

        <section className="mt-14" aria-labelledby="threat-matrix-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Threat matrix</p>
              <h2 id="threat-matrix-title" className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                Source-linked protections
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-ink/50">
              File hashes and line numbers are regenerated from the checked-out commit, so a
              renamed or removed test causes report generation to fail.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {evidenceCases.map((item) => (
              <article key={item.id} className="panel flex flex-col p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full bg-ink px-3 py-1 font-mono text-[10px] font-bold tracking-wide text-acid">
                    {item.id}
                  </span>
                  <span className="text-xs font-medium text-ink/40">{item.category}</span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-semibold leading-tight">
                  {item.threat}
                </h3>
                <div className="mt-5 flex gap-3 rounded-[14px] bg-emerald-50/75 p-4 text-sm leading-6 text-emerald-950">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  <p>{item.protection}</p>
                </div>
                {item.source_url ? (
                  <a
                    className="mt-6 inline-flex items-center gap-2 break-all font-mono text-[11px] font-semibold text-moss underline decoration-moss/20 underline-offset-4"
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.test} <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <p className="mt-6 break-all font-mono text-[11px] font-semibold text-moss">
                    {item.source}:{item.line} · {item.test}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-[28px] border border-amber-200 bg-amber-50/70 p-7 sm:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 text-amber-900">
                <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                <h2 className="font-display text-2xl font-semibold">What this evidence does not claim</h2>
              </div>
              <ul className="mt-5 grid gap-3 text-sm leading-6 text-amber-950/75">
                {securityEvidence.limitations.map((limitation) => (
                  <li key={limitation} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" aria-hidden="true" />
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link className="button-secondary shrink-0" to="/audit">
              Inspect on-chain audit
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-line bg-white/65 p-7 sm:p-9">
          <p className="eyebrow">AI boundary</p>
          <h2 className="mt-3 font-display text-3xl font-semibold">AI explains evidence; it does not manufacture it.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/55">
            The dashboard can use NEAR AI to translate a verified result into plain English.
            Attack definitions, contract probes, expected protections, and pass/fail outcomes
            remain deterministic and source-controlled.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.055] p-5">
      <p className="font-display text-4xl font-semibold text-acid">{value}</p>
      <p className="mt-2 text-xs text-white/45">{label}</p>
    </div>
  );
}
