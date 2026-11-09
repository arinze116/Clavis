import {
  AlertTriangle,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Radar,
} from "lucide-react";
import { useState } from "react";

import type { AnomalyEntry } from "../types";
import { formatTimestamp } from "../utils/format";
import { analyzeAnomaly, type AiAnomalyAnalysis } from "../utils/nearAi";

export function AnomalyAlerts({
  contractId,
  anomalies,
  writeBusy,
  busyId,
  onDismiss,
}: {
  contractId: string;
  anomalies: AnomalyEntry[];
  writeBusy: boolean;
  busyId: number | null;
  onDismiss: (anomaly: AnomalyEntry) => Promise<void>;
}) {
  const active = anomalies.filter((anomaly) => !anomaly.reviewed).reverse();
  const [analysisById, setAnalysisById] = useState<Record<number, AiAnomalyAnalysis>>({});
  const [analysisErrorById, setAnalysisErrorById] = useState<Record<number, string>>({});
  const [analysisBusy, setAnalysisBusy] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function analyze(anomaly: AnomalyEntry) {
    if (analysisById[anomaly.anomaly_id]) {
      setExpandedId((current) => (current === anomaly.anomaly_id ? null : anomaly.anomaly_id));
      return;
    }
    setAnalysisBusy(anomaly.anomaly_id);
    setExpandedId(anomaly.anomaly_id);
    setAnalysisErrorById((current) => ({ ...current, [anomaly.anomaly_id]: "" }));
    try {
      const analysis = await analyzeAnomaly(contractId, anomaly.anomaly_id);
      setAnalysisById((current) => ({ ...current, [anomaly.anomaly_id]: analysis }));
    } catch (reason) {
      setAnalysisErrorById((current) => ({
        ...current,
        [anomaly.anomaly_id]:
          reason instanceof Error ? reason.message : "Unable to analyze this anomaly",
      }));
    } finally {
      setAnalysisBusy(null);
    }
  }

  return (
    <section id="anomalies" className="panel scroll-mt-28 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Agent watch</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Anomaly alerts</h2>
        </div>
        <Radar className="h-5 w-5 text-moss" />
      </div>
      <div className="mt-6 space-y-3">
        {active.map((anomaly) => {
          const expanded = expandedId === anomaly.anomaly_id;
          const analysis = analysisById[anomaly.anomaly_id];
          const analysisError = analysisErrorById[anomaly.anomaly_id];
          return (
            <article
              key={anomaly.anomaly_id}
              className="rounded-[16px] border border-amber-200 bg-amber-50/70 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {anomaly.anomaly_type.replaceAll("_", " ")}
                    </p>
                    <span
                      className={`rounded-[5px] px-2 py-0.5 text-[10px] font-semibold ${
                        anomaly.severity === "HIGH"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {anomaly.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink/55">{anomaly.description}</p>
                  <p className="mt-2 font-mono text-[10px] text-ink/35">
                    {formatTimestamp(anomaly.timestamp)} UTC
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-moss disabled:opacity-50"
                      disabled={analysisBusy === anomaly.anomaly_id}
                      onClick={() => void analyze(anomaly)}
                      aria-expanded={expanded}
                    >
                      {analysisBusy === anomaly.anomaly_id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BrainCircuit className="h-3.5 w-3.5" />
                      )}
                      {analysisBusy === anomaly.anomaly_id
                        ? "Analyzing"
                        : analysis
                          ? expanded
                            ? "Hide AI analysis"
                            : "Show AI analysis"
                          : "Analyze with AI"}
                      {analysis &&
                        (expanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ))}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-white text-ink/45 transition-colors hover:text-moss disabled:opacity-30"
                  disabled={writeBusy || busyId === anomaly.anomaly_id}
                  onClick={() => void onDismiss(anomaly).catch(() => undefined)}
                  aria-label="Mark anomaly reviewed"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>

              {expanded && (analysis || analysisError) && (
                <div
                  className={`mt-4 rounded-[12px] border px-4 py-4 text-sm leading-6 ${
                    analysisError
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-moss/20 bg-white text-ink/70"
                  }`}
                  role={analysisError ? "alert" : "status"}
                >
                  {analysisError ||
                    (analysis && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-ink px-2 py-1 text-[10px] font-semibold text-white">
                            {analysis.severity} severity
                          </span>
                          <span className="text-[11px] text-ink/40">
                            Advisory hypothesis engine — {analysis.modelLabel}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-700">
                          Verified from {analysis.evidence.source} at final block {analysis.evidence.block_height}.
                        </p>
                        <p>{analysis.meaning}</p>
                        <p>
                          <span className="font-semibold text-ink">AI hypothesis:</span>{" "}
                          {causeLabel(analysis.likely_cause)} — {analysis.cause_reasoning}
                        </p>
                        <p className="text-xs text-ink/50">{analysis.interpretation}</p>
                        <p>
                          <span className="font-semibold text-ink">Severity reasoning:</span>{" "}
                          {analysis.severity_reasoning}
                        </p>
                        <div>
                          <p className="font-semibold text-ink">Recommended actions</p>
                          <ol className="mt-1 list-decimal space-y-1 pl-5">
                            {analysis.actions.map((action) => <li key={action}>{action}</li>)}
                          </ol>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </article>
          );
        })}
        {active.length === 0 && (
          <div className="rounded-[16px] border border-dashed border-line px-5 py-9 text-center">
            <Check className="mx-auto h-6 w-6 text-emerald-600" />
            <p className="mt-3 text-sm font-semibold">No unreviewed anomalies in this contract view</p>
            <p className="mt-1 text-xs text-ink/45">
              This is a live ledger state, not a claim that every off-chain service is healthy.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function causeLabel(cause: AiAnomalyAnalysis["likely_cause"]): string {
  if (cause === "compromised_agent") return "Possible compromised agent";
  if (cause === "normal_behavior") return "Likely normal behavior";
  return "Likely configuration issue";
}
