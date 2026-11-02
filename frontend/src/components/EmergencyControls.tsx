import { CirclePause, CirclePlay, Siren } from "lucide-react";
import { useState } from "react";

export function EmergencyControls({
  paused,
  busy,
  onTogglePause,
  onWithdraw,
}: {
  paused: boolean;
  busy: boolean;
  onTogglePause: () => Promise<void>;
  onWithdraw: () => Promise<void>;
}) {
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  return (
    <section className="rounded-[28px] border border-red-200 bg-red-50/70 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-5">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-red-700">Emergency controls</p><h2 className="mt-2 font-display text-2xl font-semibold">Treasury safety</h2></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${paused ? "bg-red-600 text-white" : "bg-emerald-100 text-emerald-700"}`}>{paused ? "Paused" : "Active"}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink/55">Pausing blocks every payment request immediately. Emergency withdrawal also pauses the contract and preserves a storage reserve.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" className="button-secondary border-red-200 text-red-700" disabled={busy} onClick={() => void onTogglePause()}>
          {paused ? <CirclePlay className="h-4 w-4" /> : <CirclePause className="h-4 w-4" />}
          {paused ? "Resume payments" : "Pause contract"}
        </button>
        {!confirmWithdraw ? (
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50" disabled={busy} onClick={() => setConfirmWithdraw(true)}><Siren className="h-4 w-4" /> Emergency withdraw</button>
        ) : (
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-full bg-red-700 px-5 py-3 text-sm font-semibold text-white" disabled={busy} onClick={() => { setConfirmWithdraw(false); void onWithdraw(); }}>Confirm withdrawal</button>
        )}
      </div>
    </section>
  );
}
