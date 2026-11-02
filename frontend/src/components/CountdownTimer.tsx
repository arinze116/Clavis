import { useEffect, useMemo, useState } from "react";

export function CountdownTimer({ targetTimestamp }: { targetTimestamp: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const parts = useMemo(() => {
    if (targetTimestamp === null) return null;
    const targetMs = Number(BigInt(String(targetTimestamp)) / 1_000_000n);
    const remaining = Math.max(0, targetMs - now);
    return {
      days: Math.floor(remaining / 86_400_000),
      hours: Math.floor((remaining % 86_400_000) / 3_600_000),
      minutes: Math.floor((remaining % 3_600_000) / 60_000),
      seconds: Math.floor((remaining % 60_000) / 1_000),
    };
  }, [targetTimestamp, now]);

  if (!parts) return <p className="text-sm text-ink/50">Triggered manually when a milestone is approved.</p>;
  return (
    <div className="grid grid-cols-4 gap-2">
      {Object.entries(parts).map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-canvas p-3 text-center">
          <p className="font-display text-2xl font-semibold tabular-nums">{String(value).padStart(2, "0")}</p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-ink/35">{label}</p>
        </div>
      ))}
    </div>
  );
}
