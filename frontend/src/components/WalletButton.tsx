import { LogOut, WalletCards } from "lucide-react";

import { useToast } from "../contexts/ToastContext";
import { useWallet } from "../contexts/WalletContext";
import { maskAccount } from "../utils/format";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { accountId, connect, disconnect, loading } = useWallet();
  const { showToast } = useToast();

  async function runWalletAction(action: () => Promise<void>, fallback: string) {
    try {
      await action();
    } catch (reason) {
      showToast({ message: reason instanceof Error ? reason.message : fallback });
    }
  }

  if (loading) {
    return <span className="h-11 w-32 animate-pulse rounded-full bg-ink/10" />;
  }

  if (!accountId) {
    return (
      <button
        type="button"
        className="button-primary"
        onClick={() => void runWalletAction(connect, "Unable to open the wallet selector")}
      >
        <WalletCards className="h-4 w-4" />
        {compact ? "Connect" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex min-h-11 max-w-[190px] items-center gap-2 rounded-full border border-ink/10 bg-white px-4"
        title={accountId}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <span className="truncate font-mono text-xs">{maskAccount(accountId)}</span>
      </span>
      <button
        type="button"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 bg-white text-ink transition hover:border-ink/30 hover:bg-ink hover:text-white"
        onClick={() => void runWalletAction(disconnect, "Unable to disconnect the wallet")}
        title="Disconnect wallet"
        aria-label="Disconnect wallet"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
