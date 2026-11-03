import { BellRing, LogOut, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { useToast } from "../contexts/ToastContext";
import { useWallet } from "../contexts/WalletContext";
import { maskAccount } from "../utils/format";
import { hasActiveNotificationSession } from "../utils/notifications";
import { NotificationSettingsModal } from "./NotificationSettingsModal";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { accountId, wallet, connect, disconnect, loading } = useWallet();
  const { showToast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsActive, setNotificationsActive] = useState(
    Boolean(accountId && hasActiveNotificationSession(accountId)),
  );

  useEffect(() => {
    const update = () => {
      setNotificationsActive(Boolean(accountId && hasActiveNotificationSession(accountId)));
    };
    update();
    window.addEventListener("clavis:notification-preferences", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("clavis:notification-preferences", update);
      window.removeEventListener("storage", update);
    };
  }, [accountId]);

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
      <button
        type="button"
        className="inline-flex min-h-11 max-w-[210px] items-center gap-2 rounded-full border border-ink/10 bg-white px-4 text-ink transition hover:border-ink/30 hover:bg-canvas"
        title={accountId}
        aria-label={`Open wallet and notification settings for ${accountId}`}
        onClick={() => setSettingsOpen(true)}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <WalletCards className="h-4 w-4 shrink-0 text-moss" />
        <span className="truncate font-mono text-xs">{maskAccount(accountId)}</span>
        {notificationsActive && (
          <BellRing
            className="h-3.5 w-3.5 shrink-0 text-emerald-600"
            aria-label="Notifications linked"
          />
        )}
      </button>
      <button
        type="button"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 bg-white text-ink transition hover:border-ink/30 hover:bg-ink hover:text-white"
        onClick={() => void runWalletAction(disconnect, "Unable to disconnect the wallet")}
        title="Disconnect wallet"
        aria-label="Disconnect wallet"
      >
        <LogOut className="h-4 w-4" />
      </button>
      {settingsOpen && wallet && (
        <NotificationSettingsModal
          key={accountId}
          accountId={accountId}
          wallet={wallet}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
