import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

const transactionHashPattern = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

export function PendingSettlementRecovery({
  recoveryAtNanoseconds,
  observedAtNanoseconds,
  busy,
  onResolve,
}: {
  recoveryAtNanoseconds: string;
  observedAtNanoseconds: string;
  busy: boolean;
  onResolve: (delivered: boolean, transactionHash: string) => Promise<void>;
}) {
  const [transactionHash, setTransactionHash] = useState("");
  const [outcome, setOutcome] = useState<"delivered" | "failed" | "">("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recoverable = useMemo(
    () => BigInt(observedAtNanoseconds) >= BigInt(recoveryAtNanoseconds),
    [observedAtNanoseconds, recoveryAtNanoseconds],
  );
  const recoveryDate = new Date(Number(BigInt(recoveryAtNanoseconds) / 1_000_000n));
  const validHash = transactionHashPattern.test(transactionHash.trim());

  async function resolve() {
    if (!recoverable || !validHash || !outcome || !acknowledged) return;
    setError(null);
    try {
      await onResolve(outcome === "delivered", transactionHash.trim());
      setTransactionHash("");
      setOutcome("");
      setAcknowledged(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to resolve pending settlement");
    }
  }

  return (
    <section className="rounded-[20px] border border-amber-300 bg-amber-50 p-6 lg:p-8" aria-labelledby="pending-settlement-title">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
            Settlement recovery
          </p>
          <h2 id="pending-settlement-title" className="mt-2 font-display text-2xl font-semibold">
            Native payment callback pending
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            New payments and emergency withdrawal stay locked. Inspect the final Testnet receipt
            before resolving this state; falsely marking a delivered transfer as failed can cause a
            duplicate retry.
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-[10px] bg-white/80 px-3 py-2 text-xs text-ink/60" role="status">
        {recoverable
          ? "The ten-minute finality window has elapsed."
          : `Recovery becomes available at ${recoveryDate.toLocaleString()}.`}
      </p>

      <label className="mt-4 block text-xs font-semibold text-ink/65" htmlFor="recovery-transaction-hash">
        Final NEAR transaction hash
      </label>
      <input
        id="recovery-transaction-hash"
        className="mt-2 min-h-11 w-full rounded-[10px] border border-amber-200 bg-white px-3 font-mono text-xs text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/15"
        value={transactionHash}
        onChange={(event) => setTransactionHash(event.target.value)}
        placeholder="Paste the reviewed Testnet transaction hash"
        spellCheck={false}
        autoComplete="off"
      />

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-ink/65">Final receipt outcome</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([
            ["delivered", "Transfer delivered"],
            ["failed", "Transfer failed"],
          ] as const).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-2 rounded-[10px] border border-amber-200 bg-white px-3 text-sm">
              <input
                type="radio"
                name="settlement-recovery-outcome"
                value={value}
                checked={outcome === value}
                onChange={() => setOutcome(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-ink/60">
        <input
          className="mt-1"
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        I verified this hash on NEAR Testnet and understand that the attestation controls rollback
        versus final approval.
      </label>

      {error && <p className="mt-3 text-xs text-red-700" role="alert">{error}</p>}
      <button
        type="button"
        className="button-primary mt-5 w-full"
        disabled={busy || !recoverable || !validHash || !outcome || !acknowledged}
        onClick={() => void resolve()}
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        Resolve stale callback
      </button>
    </section>
  );
}
