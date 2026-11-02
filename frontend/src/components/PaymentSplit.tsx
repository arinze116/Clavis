import type { SplitConfig } from "../types";
import { chainLabel } from "../utils/format";

const colors = ["#315b38", "#c8ff62", "#11130f"];

export function PaymentSplit({ splits }: { splits: SplitConfig[] }) {
  const normalized = splits.length ? splits : [];
  let offset = 0;
  const gradient = normalized.length
    ? `conic-gradient(${normalized.map((split, index) => {
        const start = offset;
        offset += split.percentage;
        return `${colors[index % colors.length]} ${start}% ${offset}%`;
      }).join(", ")})`
    : "#e7e3d8";

  return (
    <section className="panel p-6 lg:p-8">
      <p className="eyebrow">Payment split</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Cross-chain allocation</h2>
      <div className="mt-7 flex items-center gap-7">
        <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: gradient }}><div className="absolute inset-5 rounded-full bg-white" /></div>
        <div className="min-w-0 flex-1 space-y-3">
          {normalized.map((split, index) => (
            <div key={`${split.chain}-${split.token}`} className="flex items-center justify-between gap-4 text-sm"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index % colors.length] }} />{chainLabel(split.chain)} · {split.token}</span><strong>{split.percentage}%</strong></div>
          ))}
          {normalized.length === 0 && <p className="text-sm text-ink/45">100% to the primary route.</p>}
        </div>
      </div>
    </section>
  );
}
