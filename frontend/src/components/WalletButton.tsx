import { Check, Copy, LogOut, Settings2, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { useToast } from "../contexts/ToastContext";
import { useWallet } from "../contexts/WalletContext";
import { maskAccount } from "../utils/format";
import { hasActiveNotificationSession } from "../utils/notifications";
import { NotificationSettingsModal } from "./NotificationSettingsModal";

export function WalletButton({
  compact = false,
  copyAccountOnClick = false,
}: {
  compact?: boolean;
  copyAccountOnClick?: boolean;
}) {
  const { accountId, wallet, connect, disconnect, loading } = useWallet();
  const { showToast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  async function copyAccountId() {
    if (!accountId) return;
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      showToast({ message: "Unable to copy the wallet address" });
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
      <div className="relative">
        <button
          type="button"
          className="inline-flex min-h-11 max-w-[210px] items-center gap-2 rounded-full border border-ink/10 bg-white px-4 text-ink transition hover:border-ink/30 hover:bg-canvas"
          title={
            copyAccountOnClick
              ? `Copy ${accountId}`
              : `Wallet & notification settings · ${accountId}`
          }
          aria-label={
            copyAccountOnClick
              ? `Copy wallet address ${accountId}`
              : `Open wallet and notification settings for ${accountId}`
          }
          onClick={() =>
            copyAccountOnClick ? void copyAccountId() : setSettingsOpen(true)
          }
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <WalletCards className="h-4 w-4 shrink-0 text-moss" />
          <span className="truncate font-mono text-xs">{maskAccount(accountId)}</span>
          {copyAccountOnClick ? (
            copied ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0 text-ink/45" aria-hidden="true" />
            )
          ) : (
            <Settings2
              className={`h-3.5 w-3.5 shrink-0 ${
                notificationsActive ? "text-emerald-600" : "text-ink/35"
              }`}
              aria-label={notificationsActive ? "Notifications linked" : "Set up notifications"}
            />
          )}
        </button>
        {copyAccountOnClick && copied && (
          <span
            className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-white shadow-lg"
            role="status"
          >
            Copied!
          </span>
        )}
      </div>
      <button
        type="button"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 bg-white text-ink transition hover:border-ink/30 hover:bg-ink hover:text-white"
        onClick={() => void runWalletAction(disconnect, "Unable to disconnect the wallet")}
        title="Disconnect wallet"
        aria-label="Disconnect wallet"
      >
        <LogOut className="h-4 w-4" />
      </button>
      {!copyAccountOnClick && settingsOpen && wallet && (
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
