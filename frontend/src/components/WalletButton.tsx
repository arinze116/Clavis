import { LogOut, WalletCards } from "lucide-react";

import { useWallet } from "../contexts/WalletContext";
import { maskAccount } from "../utils/format";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { accountId, connect, disconnect, loading } = useWallet();

  if (loading) {
    return <span className="h-11 w-32 animate-pulse rounded-full bg-ink/10" />;
  }

  if (!accountId) {
    return (
      <button type="button" className="button-primary" onClick={() => void connect()}>
        <WalletCards className="h-4 w-4" />
        {compact ? "Connect" : "Connect wallet"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="button-secondary max-w-[230px]"
      onClick={() => void disconnect()}
      title="Disconnect wallet"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
      <span className="truncate font-mono text-xs">{maskAccount(accountId)}</span>
      <LogOut className="h-3.5 w-3.5 shrink-0 opacity-50" />
    </button>
  );
}
