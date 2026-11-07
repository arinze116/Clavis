import {
  BrainCircuit,
  Check,
  CirclePause,
  CirclePlay,
  LoaderCircle,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { SecurityAuditResult, SecurityAuditScenario } from "../types";
import {
  generateSecuritySummary,
  type AiSecurityScenario,
  type SecurityScenarioKind,
} from "../utils/nearAi";
import { Modal } from "./Modal";

type AuditStatus = "queued" | "running" | "blocked" | "failed";

interface AuditFeedItem extends AiSecurityScenario {
  status: AuditStatus;
  resultReason?: string;
}

const contractScenarioByKind: Record<SecurityScenarioKind, SecurityAuditScenario> = {
  unapproved_recipient: "UNAPPROVED_RECIPIENT",
  over_limit_payment: "OVER_LIMIT_PAYMENT",
  suspended_recipient: "SUSPENDED_RECIPIENT",
  daily_limit_breach: "DAILY_LIMIT_BREACH",
  off_hours_payment: "OFF_HOURS_PAYMENT",
};

const canonicalSecurityProbes: AiSecurityScenario[] = [
  {
    kind: "unapproved_recipient",
    title: "Unapproved recipient",
    description: "Attempts to authorize a payment to a recipient that is not on the contract roster.",
    expected_protection: "The recipient allowlist must reject the request before any value can move.",
  },
  {
    kind: "over_limit_payment",
    title: "Per-payment limit bypass",
    description: "Attempts to request more than the contract's configured maximum for one payment.",
    expected_protection: "The per-payment limit must reject the oversized request.",
  },
  {
    kind: "suspended_recipient",
    title: "Suspended recipient",
    description: "Attempts to pay a roster member after the owner has suspended that recipient.",
    expected_protection: "The active-status check must block the request.",
  },
  {
    kind: "daily_limit_breach",
    title: "Daily treasury limit",
    description: "Attempts to authorize spending beyond the remaining daily allowance.",
    expected_protection: "Checked daily accounting must reject the request without changing spend state.",
  },
  {
    kind: "off_hours_payment",
    title: "Off-hours payment",
    description: "Attempts to authorize payroll outside the contract's allowed operating window.",
    expected_protection: "The on-chain schedule rule must reject the request.",
  },
];

export function EmergencyControls({
  contractId,
  paused,
  busy,
  onTogglePause,
  onWithdraw,
  onSecurityAudit,
}: {
  contractId: string;
  paused: boolean;
  busy: boolean;
  onTogglePause: () => Promise<void>;
  onWithdraw: () => Promise<void>;
  onSecurityAudit: () => Promise<SecurityAuditResult[]>;
}) {
  const [pauseOpen, setPauseOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAcknowledged, setWithdrawAcknowledged] = useState(false);
  const [withdrawConfirmation, setWithdrawConfirmation] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [auditFeed, setAuditFeed] = useState<AuditFeedItem[]>([]);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditComplete, setAuditComplete] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [securitySummary, setSecuritySummary] = useState<string | null>(null);
  const [summaryModelLabel, setSummaryModelLabel] = useState<string | null>(null);

  async function togglePause() {
    setActionError(null);
    try {
      await onTogglePause();
      setPauseOpen(false);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Unable to update contract state");
    }
  }

  async function withdraw() {
    setActionError(null);
    try {
      await onWithdraw();
      setWithdrawOpen(false);
      setWithdrawAcknowledged(false);
      setWithdrawConfirmation("");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Emergency withdrawal failed");
    }
  }

  async function runAudit() {
    setAuditRunning(true);
    setAuditComplete(false);
    setActionError(null);
    setAiWarning(null);
    setSecuritySummary(null);
    setSummaryModelLabel(null);
    const scenarios = canonicalSecurityProbes;

    setAuditFeed(scenarios.map((scenario) => ({ ...scenario, status: "queued" })));
    try {
      // Paint every deterministic probe before the wallet transaction starts.
      await wait(750);
      setAuditFeed((current) =>
        current.map((item, index) => ({ ...item, status: index === 0 ? "running" : "queued" })),
      );
      const results = await onSecurityAudit();
      const resultsByScenario = new Map(results.map((result) => [result.scenario, result]));
      for (let index = 0; index < scenarios.length; index += 1) {
        const scenario = scenarios[index];
        if (!scenario) continue;
        const result = resultsByScenario.get(contractScenarioByKind[scenario.kind]);
        setAuditFeed((current) =>
          current.map((item, itemIndex) => ({
            ...item,
            status:
              itemIndex < index
                ? item.status
                : itemIndex === index
                  ? result?.blocked
                    ? "blocked"
                    : "failed"
                : itemIndex === index + 1
                  ? "running"
                  : "queued",
            ...(itemIndex === index && result ? { resultReason: result.reason } : {}),
          })),
        );
        await wait(300);
      }
      const complete =
        results.length === scenarios.length &&
        scenarios.every(
          (scenario) => resultsByScenario.get(contractScenarioByKind[scenario.kind])?.blocked,
        );
      setAuditComplete(complete);
      if (!complete) {
        setActionError("Security audit failed: one or more contract protections did not block the probe.");
      } else {
        try {
          const summary = await generateSecuritySummary({ contractId, scenarios, results });
          setSecuritySummary(summary.text);
          setSummaryModelLabel(summary.modelLabel);
        } catch (reason) {
          setAiWarning(
            `The on-chain audit completed, but NEAR AI could not generate the final summary. ${
              reason instanceof Error ? reason.message : ""
            }`.trim(),
          );
        }
      }
    } catch (reason) {
      setAuditFeed((current) =>
        current.map((item) =>
          item.status === "running" ? { ...item, status: "failed" } : item,
        ),
      );
      setActionError(reason instanceof Error ? reason.message : "Security audit failed");
    } finally {
      setAuditRunning(false);
    }
  }

  return (
    <section id="security-audit" className="scroll-mt-28 rounded-[20px] border border-red-200 bg-red-50/70 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold text-red-700">Emergency controls</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Treasury safety</h2>
        </div>
        <span
          className={`rounded-[6px] px-3 py-1 text-xs font-semibold ${
            paused ? "bg-red-600 text-white" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {paused ? "Paused" : "Active"}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink/55">
        Pausing blocks every payment request immediately. Emergency withdrawal also pauses the
        contract and preserves its storage reserve.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="button-secondary border-red-200 text-red-700"
          disabled={busy}
          onClick={() => (paused ? void togglePause() : setPauseOpen(true))}
        >
          {paused ? <CirclePlay className="h-4 w-4" /> : <CirclePause className="h-4 w-4" />}
          {paused ? "Unpause contract" : "Pause contract"}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            setActionError(null);
            setWithdrawOpen(true);
          }}
        >
          <Siren className="h-4 w-4" /> Emergency withdraw
        </button>
      </div>

      <div className="mt-6 border-t border-red-200 pt-6">
        <div className="flex items-start gap-3">
          <BrainCircuit className="mt-0.5 h-5 w-5 text-red-700" />
          <div>
            <h3 className="text-sm font-semibold">Deterministic contract probes</h3>
            <p className="mt-1 text-xs leading-5 text-ink/55">
              Five versioned probes exercise the contract's real rule evaluator without moving
              funds. NEAR AI only summarizes the verified results afterward.
            </p>
            <Link className="mt-2 inline-flex text-xs font-semibold text-red-700 underline" to="/security">
              View the reproducible threat model and CI evidence
            </Link>
          </div>
        </div>
        <button
          type="button"
          className="button-primary mt-4 w-full"
          disabled={busy || auditRunning}
          onClick={() => void runAudit()}
        >
          {auditRunning ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {auditRunning ? "Running contract probes" : "Run contract security probes"}
        </button>

        {aiWarning && (
          <p className="mt-3 rounded-[10px] bg-amber-100 px-3 py-2 text-xs leading-5 text-amber-900" role="status">
            {aiWarning}
          </p>
        )}

        {auditFeed.length > 0 && (
          <div className="mt-4 space-y-2" aria-live="polite">
            <p className="text-[11px] text-ink/45">
              Fixed probes from the versioned Clavis threat model. These descriptions are not AI-generated.
            </p>
            {auditFeed.map((item, index) => (
              <div key={item.kind} className="rounded-[10px] border border-red-200 bg-white px-3 py-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {item.status === "running" && <LoaderCircle className="h-4 w-4 animate-spin text-moss" />}
                  {item.status === "blocked" && <Check className="h-4 w-4 text-emerald-600" />}
                  {item.status === "failed" && <Siren className="h-4 w-4 text-red-600" />}
                  {item.status === "queued" && <span className="h-2 w-2 rounded-full bg-ink/20" />}
                  <span>Attack {index + 1}: {item.title}</span>
                  <span className="ml-auto text-xs text-ink/45">
                    {item.status === "blocked" ? "Blocked" : item.status}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-ink/50">{item.description}</p>
                <p className="mt-1 text-xs leading-5 text-ink/45">
                  Expected protection: {item.expected_protection}
                </p>
                {item.resultReason && (
                  <p className="mt-1 text-xs font-medium text-ink/65">{item.resultReason}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {auditComplete && (
          <div className="mt-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900" role="status">
            <p className="font-semibold">Contract probes complete — 5/5 attacks blocked.</p>
            {securitySummary && <p className="mt-2 leading-6">{securitySummary}</p>}
            {summaryModelLabel && (
              <p className="mt-2 text-[11px] text-emerald-800/70">
                Probe facts verified on-chain; next-step engine — {summaryModelLabel}
              </p>
            )}
          </div>
        )}
      </div>

      {actionError && !pauseOpen && !withdrawOpen && (
        <p className="mt-4 rounded-[10px] bg-red-100 px-4 py-3 text-sm text-red-800" role="alert">
          {actionError}
        </p>
      )}

      {pauseOpen && (
        <Modal
          title="Pause all payment requests?"
          description="Pausing the contract blocks ALL payment requests immediately. Are you sure?"
          onClose={() => setPauseOpen(false)}
          size="sm"
          danger
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void togglePause();
            }}
          >
            {actionError && <p className="mb-4 text-sm text-red-700" role="alert">{actionError}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="button-secondary" onClick={() => setPauseOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy}
            >
              <CirclePause className="h-4 w-4" /> Pause contract
            </button>
            </div>
          </form>
        </Modal>
      )}

      {withdrawOpen && (
        <Modal
          title="Emergency treasury withdrawal"
          description="This submits an owner transaction that pauses the contract and returns its withdrawable balance while preserving a storage reserve."
          onClose={() => setWithdrawOpen(false)}
          size="sm"
          danger
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (withdrawAcknowledged && withdrawConfirmation.trim() === "WITHDRAW") {
                void withdraw();
              }
            }}
          >
            <label className="flex items-start gap-3 rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm leading-6">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-red-600"
                checked={withdrawAcknowledged}
                onChange={(event) => setWithdrawAcknowledged(event.target.checked)}
              />
              I understand this will pause the contract
            </label>
            <label className="text-xs font-semibold text-ink/55">
              Type WITHDRAW to confirm
              <input
                className="field mt-2 font-mono"
                value={withdrawConfirmation}
                onChange={(event) => setWithdrawConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>
            {actionError && <p className="text-sm text-red-700" role="alert">{actionError}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="button-secondary" onClick={() => setWithdrawOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-red-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={
                  busy || !withdrawAcknowledged || withdrawConfirmation.trim() !== "WITHDRAW"
                }
              >
                <Siren className="h-4 w-4" /> Withdraw treasury
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
