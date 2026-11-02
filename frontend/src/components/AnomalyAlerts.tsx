import { AlertTriangle, Check, Radar } from "lucide-react";

import type { AnomalyEntry } from "../types";
import { formatTimestamp } from "../utils/format";

export function AnomalyAlerts({
  anomalies,
  busyId,
  onDismiss,
}: {
  anomalies: AnomalyEntry[];
  busyId: number | null;
  onDismiss: (anomaly: AnomalyEntry) => void;
}) {
  const active = anomalies.filter((anomaly) => !anomaly.reviewed).reverse();
  return (
    <section className="panel p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><p className="eyebrow">Agent watch</p><h2 className="mt-2 font-display text-2xl font-semibold">Anomaly alerts</h2></div>
        <Radar className="h-5 w-5 text-moss" />
      </div>
      <div className="mt-6 space-y-3">
        {active.map((anomaly) => (
          <article key={anomaly.anomaly_id} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{anomaly.anomaly_type.replaceAll("_", " ")}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${anomaly.severity === "HIGH" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{anomaly.severity}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-ink/55">{anomaly.description}</p>
                <p className="mt-2 font-mono text-[10px] text-ink/35">{formatTimestamp(anomaly.timestamp)}</p>
              </div>
              <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ink/45 hover:text-moss disabled:opacity-30" disabled={busyId === anomaly.anomaly_id} onClick={() => onDismiss(anomaly)} aria-label="Mark anomaly reviewed"><Check className="h-4 w-4" /></button>
            </div>
          </article>
        ))}
        {active.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-5 py-9 text-center">
            <Check className="mx-auto h-6 w-6 text-emerald-600" />
            <p className="mt-3 text-sm font-semibold">No anomalies detected</p>
            <p className="mt-1 text-xs text-ink/45">The agent and contract policy are operating normally.</p>
          </div>
        )}
      </div>
    </section>
  );
}
