import { ShieldCheck, Wallet } from "lucide-react";

import { formatNear } from "../utils/format";

interface TreasuryStatusProps {
  balance: string;
  dailyLimit: string;
  dailySpent: string;
  dailyWindowExpired: boolean;
}

export function TreasuryStatus({
  balance,
  dailyLimit,
  dailySpent,
  dailyWindowExpired,
}: TreasuryStatusProps) {
  const limit = BigInt(dailyLimit || "0");
  const spent = BigInt(dailySpent || "0");
  const percentage = limit > 0n ? Number((spent * 100n) / limit) : 0;
  const progressColor = percentage >= 90 ? "bg-red-500" : percentage >= 60 ? "bg-amber-400" : "bg-moss";

  return (
    <section className="panel overflow-hidden p-6 lg:p-8">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Contract authorization</p>
          <p className="mt-3 font-display text-4xl font-semibold tracking-tight lg:text-5xl">
            {formatNear(balance)}
          </p>
          <p className="mt-2 text-sm leading-6 text-ink/50">
            Contract account balance on NEAR testnet; settlement funding is separate and not verified here.
          </p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-acid">
          <Wallet className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-9 rounded-2xl bg-canvas p-5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-moss" /> Daily authorization
          </span>
          <span className="font-mono text-xs text-ink/55">{percentage}% used</span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink/10">
          <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-xs text-ink/45">
          <span>{formatNear(dailySpent)} authorized</span>
          <span>{formatNear(dailyLimit)} limit</span>
        </div>
        {dailyWindowExpired && (
          <p className="mt-3 text-xs leading-5 text-ink/50">
            The stored counter expired; the next contract request evaluates this window from zero.
          </p>
        )}
      </div>
    </section>
  );
}
