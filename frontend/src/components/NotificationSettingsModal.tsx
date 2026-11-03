import type { Wallet } from "@near-wallet-selector/core";
import {
  BellRing,
  Check,
  Copy,
  ExternalLink,
  Mail,
  Send,
  Unlink,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  getLinkedNotificationSettings,
  linkNotificationSettings,
} from "../utils/notifications";

interface Props {
  accountId: string;
  wallet: Wallet;
  onClose: () => void;
}

const telegramBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim();

export function NotificationSettingsModal({ accountId, wallet, onClose }: Props) {
  const current = getLinkedNotificationSettings(accountId);
  const [email, setEmail] = useState(current?.email ?? "");
  const [telegramChatId, setTelegramChatId] = useState(current?.telegramChatId ?? "");
  const [linked, setLinked] = useState(Boolean(current?.email || current?.telegramChatId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function save(nextEmail = email, nextTelegramChatId = telegramChatId) {
    const normalizedEmail = nextEmail.trim();
    const normalizedTelegram = nextTelegramChatId.trim();
    if (!normalizedEmail && !normalizedTelegram) {
      setError("Add an email address, a Telegram chat ID, or both.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const settings = await linkNotificationSettings({
        wallet,
        accountId,
        email: normalizedEmail || null,
        telegramChatId: normalizedTelegram || null,
      });
      setLinked(Boolean(settings.email || settings.telegramChatId));
      setMessage("Notifications linked. A confirmation was sent to each available channel.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to link notifications");
    } finally {
      setSaving(false);
    }
  }

  async function unlink() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await linkNotificationSettings({
        wallet,
        accountId,
        email: null,
        telegramChatId: null,
      });
      setEmail("");
      setTelegramChatId("");
      setLinked(false);
      setMessage("Email and Telegram notifications were unlinked.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to unlink notifications");
    } finally {
      setSaving(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[100] grid place-items-end bg-ink/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-canvas p-5 text-ink shadow-2xl sm:max-w-lg sm:rounded-[28px] sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-settings-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-acid text-ink">
              <BellRing className="h-5 w-5" />
            </span>
            <h2 id="notification-settings-title" className="mt-4 font-display text-3xl font-semibold">
              Wallet & notifications
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/50">
              Link private off-chain channels for transaction, payroll, anomaly, and delivery alerts.
            </p>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/10 bg-white"
            onClick={onClose}
            aria-label="Close notification settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{accountId}</span>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-ink/45 transition hover:bg-canvas hover:text-ink"
            onClick={() => void navigator.clipboard.writeText(accountId)}
            aria-label="Copy connected wallet address"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block rounded-2xl border border-line bg-white p-4">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="h-4 w-4 text-moss" /> Email notifications
              {email.trim() && <Check className="ml-auto h-4 w-4 text-emerald-600" />}
            </span>
            <input
              type="email"
              className="field mt-3"
              placeholder="owner@business.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Send className="h-4 w-4 text-moss" /> Telegram notifications
              {telegramChatId.trim() && <Check className="ml-auto h-4 w-4 text-emerald-600" />}
            </div>
            <input
              inputMode="numeric"
              className="field mt-3 font-mono text-xs"
              placeholder="Telegram chat ID"
              value={telegramChatId}
              onChange={(event) => setTelegramChatId(event.target.value)}
              pattern="-?[0-9]{5,20}"
            />
            <p className="mt-3 text-xs leading-5 text-ink/45">
              Start the Clavis bot, then paste your numeric Telegram chat ID.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {telegramBotUsername && (
                <a
                  className="inline-flex items-center gap-2 text-xs font-semibold text-moss"
                  href={`https://t.me/${telegramBotUsername.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Clavis bot <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <a
                className="inline-flex items-center gap-2 text-xs font-semibold text-moss"
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
              >
                Find my chat ID <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700">{error}</p>}
        {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">{message}</p>}

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
          <button
            type="button"
            className="button-primary w-full"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Waiting for wallet…" : "Link notification channels"}
          </button>
          {linked && (
            <button
              type="button"
              className="button-secondary text-red-700"
              disabled={saving}
              onClick={() => void unlink()}
            >
              <Unlink className="h-4 w-4" /> Unlink
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-[11px] leading-5 text-ink/40">
          Linking requires a wallet signature, costs no gas, and never stores contact details on-chain.
        </p>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
