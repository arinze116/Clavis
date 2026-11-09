import type { Wallet } from "@near-wallet-selector/core";
import {
  BellRing,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Mail,
  Send,
  ShieldCheck,
  Unlink,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  beginEmailNotificationLink,
  beginTelegramNotificationLink,
  cancelTelegramNotificationLink,
  checkTelegramNotificationLink,
  clearPendingTelegramLink,
  confirmEmailNotificationLink,
  getLinkedNotificationSettings,
  getPendingTelegramLink,
  type EmailLinkChallenge,
  type LinkedNotificationSettings,
  type PendingTelegramLink,
  unlinkNotificationChannel,
} from "../utils/notifications";

interface Props {
  accountId: string;
  wallet: Wallet;
  onClose: () => void;
}

type BusyAction = "email-send" | "email-verify" | "telegram" | "unlink" | null;

export function NotificationSettingsModal({ accountId, wallet, onClose }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const initial = getLinkedNotificationSettings(accountId);
  const [settings, setSettings] = useState<LinkedNotificationSettings | null>(initial);
  const [email, setEmail] = useState(initial?.email ?? "");
  const [emailEditing, setEmailEditing] = useState(!initial?.email);
  const [emailChallenge, setEmailChallenge] = useState<EmailLinkChallenge | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [telegramPending, setTelegramPending] = useState<PendingTelegramLink | null>(
    getPendingTelegramLink(accountId),
  );
  const [busy, setBusy] = useState<BusyAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailLinked = Boolean(settings?.email);
  const telegramLinked = Boolean(settings?.telegramChatId);
  const anyLinked = emailLinked || telegramLinked;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panelRef.current
      ?.querySelector<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      )
      ?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      ];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (!telegramPending) return;
    let active = true;
    let timer: number | undefined;

    async function poll() {
      if (!active || !telegramPending) return;
      if (Date.parse(telegramPending.expiresAt) <= Date.now()) {
        clearPendingTelegramLink(accountId);
        setTelegramPending(null);
        setError("The Telegram connection expired. Create a new link to try again.");
        return;
      }
      try {
        const linked = await checkTelegramNotificationLink({
          accountId,
          pending: telegramPending,
        });
        if (!active) return;
        if (linked) {
          setSettings(linked);
          setTelegramPending(null);
          setBusy(null);
          setError(null);
          setMessage("Telegram notifications are connected.");
          return;
        }
      } catch (reason) {
        if (!active) return;
        const detail = reason instanceof Error ? reason.message : "Unable to check Telegram";
        if (detail.toLowerCase().includes("invalid or expired")) {
          clearPendingTelegramLink(accountId);
          setTelegramPending(null);
          setBusy(null);
          setError(detail);
          return;
        }
      }
      timer = window.setTimeout(() => void poll(), 2_500);
    }

    void poll();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [accountId, telegramPending]);

  async function sendEmailCode() {
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy("email-send");
    setError(null);
    setMessage(null);
    try {
      const challenge = await beginEmailNotificationLink({
        wallet,
        accountId,
        email: normalizedEmail,
      });
      setEmailChallenge(challenge);
      setEmail(challenge.email);
      setVerificationCode("");
      setMessage(`A six-digit code was sent to ${challenge.email}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send verification code");
    } finally {
      setBusy(null);
    }
  }

  async function verifyEmailCode() {
    if (!emailChallenge || !/^\d{6}$/.test(verificationCode.trim())) {
      setError("Enter the six-digit code from your email.");
      return;
    }
    setBusy("email-verify");
    setError(null);
    setMessage(null);
    try {
      const linked = await confirmEmailNotificationLink({
        accountId,
        challengeId: emailChallenge.challengeId,
        code: verificationCode,
      });
      setSettings(linked);
      setEmail(linked.email ?? "");
      setEmailEditing(false);
      setEmailChallenge(null);
      setVerificationCode("");
      setMessage("Email notifications are verified and connected.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to verify email");
    } finally {
      setBusy(null);
    }
  }

  async function connectTelegram() {
    setBusy("telegram");
    setError(null);
    setMessage(null);
    try {
      const pending = await beginTelegramNotificationLink({ wallet, accountId });
      setTelegramPending(pending);
      setBusy(null);
      setMessage("Telegram is ready. Open the bot and press Start to finish connecting.");
      window.open(pending.connectUrl, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setBusy(null);
      setError(reason instanceof Error ? reason.message : "Unable to connect Telegram");
    }
  }

  async function cancelTelegram() {
    if (!telegramPending) return;
    setBusy("telegram");
    setError(null);
    try {
      await cancelTelegramNotificationLink({ accountId, pending: telegramPending });
      setTelegramPending(null);
      setMessage("Telegram connection cancelled.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to cancel Telegram linking");
    } finally {
      setBusy(null);
    }
  }

  async function unlink(channel: "email" | "telegram" | "all") {
    setBusy("unlink");
    setError(null);
    setMessage(null);
    try {
      const next = await unlinkNotificationChannel({ wallet, accountId, channel });
      setSettings(next);
      if (channel === "email" || channel === "all") {
        setEmail("");
        setEmailEditing(true);
        setEmailChallenge(null);
        setVerificationCode("");
      }
      if (channel === "telegram" || channel === "all") setTelegramPending(null);
      setMessage(
        channel === "all"
          ? "All notification channels were disconnected."
          : `${channel === "email" ? "Email" : "Telegram"} notifications were disconnected.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to disconnect notifications");
    } finally {
      setBusy(null);
    }
  }

  async function copyWallet() {
    try {
      await navigator.clipboard.writeText(accountId);
      setMessage("Wallet address copied.");
    } catch {
      setError("Unable to copy the wallet address in this browser.");
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
        ref={panelRef}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-canvas p-5 text-ink shadow-2xl sm:max-w-xl sm:rounded-[28px] sm:p-7"
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
              Connect channels here. Clavis handles verification without exposing server credentials.
            </p>
          </div>
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/10 bg-white"
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
            className="grid h-11 w-11 place-items-center rounded-full text-ink/45 transition hover:bg-canvas hover:text-ink"
            onClick={() => void copyWallet()}
            aria-label="Copy connected wallet address"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <section className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-canvas text-moss">
                <Mail className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Email notifications</p>
                <p className="truncate text-xs text-ink/45">
                  {emailLinked && !emailEditing ? settings?.email : "Verify with a six-digit code"}
                </p>
              </div>
              {emailLinked && !emailEditing && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                  <Check className="h-3 w-3" /> Verified
                </span>
              )}
            </div>

            {emailLinked && !emailEditing ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="button-secondary" onClick={() => setEmailEditing(true)}>
                  Change email
                </button>
                <button
                  type="button"
                  className="button-secondary text-red-700"
                  disabled={busy !== null}
                  onClick={() => void unlink("email")}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  type="email"
                  className="field"
                  placeholder="you@business.com"
                  value={email}
                  disabled={Boolean(emailChallenge)}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
                {emailChallenge && (
                  <input
                    inputMode="numeric"
                    className="field font-mono tracking-[0.35em]"
                    placeholder="000000"
                    value={verificationCode}
                    maxLength={6}
                    onChange={(event) =>
                      setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    aria-label="Email verification code"
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="button-primary"
                    disabled={busy !== null}
                    onClick={() => void (emailChallenge ? verifyEmailCode() : sendEmailCode())}
                  >
                    {(busy === "email-send" || busy === "email-verify") && (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    )}
                    {emailChallenge ? "Verify email" : "Send verification code"}
                  </button>
                  {emailChallenge && (
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={busy !== null}
                      onClick={() => {
                        setEmailChallenge(null);
                        setVerificationCode("");
                      }}
                    >
                      Use another email
                    </button>
                  )}
                  {emailLinked && (
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={busy !== null}
                      onClick={() => {
                        setEmail(settings?.email ?? "");
                        setEmailEditing(false);
                        setEmailChallenge(null);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-canvas text-moss">
                <Send className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Telegram notifications</p>
                <p className="text-xs text-ink/45">
                  {telegramLinked ? "Connected to the Clavis bot" : "Connect without copying a chat ID"}
                </p>
              </div>
              {telegramLinked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                  <Check className="h-3 w-3" /> Connected
                </span>
              )}
            </div>

            {telegramPending ? (
              <div className="mt-4 rounded-xl bg-canvas p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <LoaderCircle className="h-4 w-4 animate-spin text-moss" />
                  Waiting for Telegram
                </div>
                <p className="mt-2 text-xs leading-5 text-ink/50">
                  Open the bot and press Start. This page will confirm the connection automatically.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    className="button-primary"
                    href={telegramPending.connectUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Telegram <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={busy !== null}
                    onClick={() => void cancelTelegram()}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="button-primary"
                  disabled={busy !== null}
                  onClick={() => void connectTelegram()}
                >
                  {busy === "telegram" && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {telegramLinked ? "Reconnect Telegram" : "Connect Telegram"}
                </button>
                {telegramLinked && (
                  <button
                    type="button"
                    className="button-secondary text-red-700"
                    disabled={busy !== null}
                    onClick={() => void unlink("telegram")}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700">{error}</p>}
        {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">{message}</p>}

        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-acid/45 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
          <p className="text-xs leading-5 text-ink/55">
            The wallet prompt is a security signature, not another sign-in or a transaction.
            Email codes and the Telegram bot verify that each channel belongs to you. No gas
            is spent.
          </p>
        </div>

        {anyLinked && (
          <button
            type="button"
            className="mt-5 inline-flex min-h-11 items-center gap-2 px-2 text-xs font-semibold text-red-700"
            disabled={busy !== null}
            onClick={() => void unlink("all")}
          >
            <Unlink className="h-4 w-4" /> Disconnect all notification channels
          </button>
        )}
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
