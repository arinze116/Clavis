import {
  Check,
  Clipboard,
  Eye,
  LockKeyhole,
  Route,
  Save,
  Send,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { AppShell } from "../components/AppShell";
import { CountdownTimer } from "../components/CountdownTimer";
import { PaymentHistory } from "../components/PaymentHistory";
import { PaymentSplit } from "../components/PaymentSplit";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { WalletButton } from "../components/WalletButton";
import { useToast } from "../contexts/ToastContext";
import { useWallet } from "../contexts/WalletContext";
import type {
  AuditEntry,
  Chain,
  ContractRecord,
  Recipient,
  SplitConfig,
  Token,
  WorkerPreferences,
} from "../types";
import {
  enrichAuditTransactions,
  getAllContracts,
  getStoredContractId,
  hashWalletAddress,
  storeContractId,
  view,
} from "../utils/contract";
import { chainLabel, formatTimestamp } from "../utils/format";
import { rootContractId } from "../utils/near";

interface WorkerProfile {
  contractId: string;
  recipient: Recipient;
  auditLog: AuditEntry[];
}

function tokenForChain(chain: Chain): Token {
  return chain === "near" ? "NEAR" : chain === "ethereum" ? "USDC" : "BUSD";
}

export default function WorkerDashboard() {
  const { accountId, loading: walletLoading } = useWallet();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [registrationChecking, setRegistrationChecking] = useState(false);
  const [nearPercentage, setNearPercentage] = useState(0);
  const [preferences, setPreferences] = useState<WorkerPreferences>({
    displayName: "",
    preferredChain: "near",
    preferredToken: "NEAR",
    walletAddress: "",
    paymentSplit: [],
  });

  const discoverProfile = useCallback(async () => {
    if (!accountId) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const recipientHash = await hashWalletAddress(accountId);
      let factoryContracts: ContractRecord[] = [];
      try {
        factoryContracts = await getAllContracts();
      } catch {
        // The root deployment remains available while the factory RPC is warming up.
      }
      // Results retain candidate order, so check the canonical root contract
      // before a factory child that may contain a duplicate registration.
      const candidateIds = new Set([
        rootContractId,
        getStoredContractId(),
        ...factoryContracts.map((contract) => contract.contract_id),
      ]);

      const results = await Promise.all(
        [...candidateIds].map(async (contractId) => {
          const [registered, directRecipient] = await Promise.all([
            view<boolean>(contractId, "is_registered", { account_id: accountId }).catch(
              () => false,
            ),
            view<Recipient | null>(contractId, "get_recipient", {
              recipient_hash: recipientHash,
            }).catch(() => null),
          ]);
          let recipient = directRecipient;
          if (!recipient && registered) {
            const recipients = await view<Recipient[]>(contractId, "get_recipients", {
              from: 0,
              limit: 100,
            }).catch(() => []);
            recipient =
              recipients.find((item) =>
                item.name.toLowerCase().includes(accountId.toLowerCase()),
              ) ?? null;
          }
          if (!recipient) return null;
          const auditLog = await view<AuditEntry[]>(
            contractId,
            "get_audit_log_reverse",
            { from: 0, limit: 100 },
          );
          return {
            contractId,
            recipient,
            auditLog: await enrichAuditTransactions(auditLog, contractId),
          } satisfies WorkerProfile;
        }),
      );
      const found = results.find((result): result is WorkerProfile => result !== null) ?? null;
      setProfile(found);
      if (found) {
        storeContractId(found.contractId);
        const stored = loadPreferences(accountId);
        const nextPreferences =
          stored ?? {
            displayName: found.recipient.name,
            preferredChain: found.recipient.preferred_chain,
            preferredToken: found.recipient.preferred_token,
            walletAddress: accountId,
            paymentSplit: found.recipient.payment_split,
          };
        setPreferences(nextPreferences);
        setNearPercentage(
          nearSplitPercentage(
            nextPreferences.paymentSplit,
            nextPreferences.preferredChain,
          ),
        );
      } else {
        const stored = loadPreferences(accountId);
        const nextPreferences =
          stored ?? {
            displayName: "",
            preferredChain: "near",
            preferredToken: "NEAR",
            walletAddress: accountId,
            paymentSplit: [],
          };
        setPreferences(nextPreferences);
        setNearPercentage(
          nearSplitPercentage(
            nextPreferences.paymentSplit,
            nextPreferences.preferredChain,
          ),
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load worker profile");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void discoverProfile();
  }, [discoverProfile]);

  const editedSplits = useMemo<SplitConfig[]>(() => {
    if (preferences.preferredChain === "near" || nearPercentage === 0) {
      return [
        {
          chain: preferences.preferredChain,
          token: preferences.preferredToken,
          percentage: 100,
        },
      ];
    }
    if (nearPercentage === 100) {
      return [{ chain: "near", token: "NEAR", percentage: 100 }];
    }
    return [
      { chain: "near", token: "NEAR", percentage: nearPercentage },
      {
        chain: preferences.preferredChain,
        token: preferences.preferredToken,
        percentage: 100 - nearPercentage,
      },
    ];
  }, [nearPercentage, preferences.preferredChain, preferences.preferredToken]);

  if (walletLoading) {
    return (
      <AppShell>
        <LoadingState label="Opening the worker portal" />
      </AppShell>
    );
  }
  if (!accountId) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <div className="panel p-10">
            <WalletCards className="mx-auto h-9 w-9 text-moss" />
            <h1 className="mt-5 font-display text-4xl">Your payroll, your view</h1>
            <p className="mt-3 text-sm leading-6 text-ink/50">
              Connect the NEAR account you share with your employer to check registration
              across Clavis businesses.
            </p>
            <div className="mt-7 flex justify-center">
              <WalletButton />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }
  if (loading) {
    return (
      <AppShell>
        <LoadingState label="Checking payroll registration" />
      </AppShell>
    );
  }
  if (error) {
    return (
      <AppShell>
        <ErrorState message={error} retry={() => void discoverProfile()} />
      </AppShell>
    );
  }

  async function copyWallet() {
    try {
      await navigator.clipboard.writeText(accountId!);
      showToast({ message: "NEAR wallet copied" });
    } catch {
      showToast({ message: "Copy failed — select the wallet address manually" });
    }
  }

  function updateChain(chain: Chain) {
    setPreferences((current) => ({
      ...current,
      preferredChain: chain,
      preferredToken: tokenForChain(chain),
      walletAddress: chain === "near" ? accountId! : current.walletAddress,
    }));
    if (chain === "near") setNearPercentage(0);
  }

  function savePreferences(message: string) {
    const next = { ...preferences, paymentSplit: editedSplits };
    window.localStorage.setItem(
      `clavis.workerPreferences.${accountId}`,
      JSON.stringify(next),
    );
    setPreferences(next);
    showToast({ message });
  }

  async function submitRegistration() {
    savePreferences("Registration preferences saved locally");
    setRegistrationChecking(true);
    setSubmitted(false);
    try {
      await discoverProfile();
      setSubmitted(true);
    } finally {
      setRegistrationChecking(false);
    }
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-5 lg:px-10 lg:py-16">
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <section className="panel p-6 sm:p-8">
              <p className="eyebrow">Worker self-service</p>
              <h1 className="mt-3 font-display text-4xl font-semibold">
                Register for payroll
              </h1>
              <p className="mt-3 text-sm leading-6 text-ink/50">
                You are not yet on a payroll roster. Fill in your preferences below, then share
                your wallet address with your employer. They will add you to their Clavis contract.
              </p>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-ink/50">
                  Display name
                  <input
                    className="field mt-2"
                    value={preferences.displayName}
                    onChange={(event) =>
                      setPreferences({ ...preferences, displayName: event.target.value })
                    }
                    placeholder="Ada Okafor"
                  />
                </label>
                <label className="text-xs font-semibold text-ink/50">
                  Preferred chain
                  <select
                    className="field mt-2"
                    value={preferences.preferredChain}
                    onChange={(event) => updateChain(event.target.value as Chain)}
                  >
                    <option value="near">NEAR</option>
                    <option value="ethereum">Ethereum</option>
                    <option value="bnb">BNB Chain</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-ink/50">
                  Preferred token
                  <input
                    className="field mt-2"
                    value={preferences.preferredToken}
                    disabled
                  />
                </label>
                <label className="text-xs font-semibold text-ink/50">
                  Wallet on selected chain
                  <input
                    className="field mt-2 font-mono text-xs"
                    value={preferences.walletAddress}
                    onChange={(event) =>
                      setPreferences({ ...preferences, walletAddress: event.target.value })
                    }
                    disabled={preferences.preferredChain === "near"}
                  />
                </label>
              </div>

              {preferences.preferredChain !== "near" && (
                <div className="mt-6 rounded-2xl border border-line p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">Optional payment split</p>
                      <p className="mt-1 text-xs text-ink/45">
                        {nearPercentage}% NEAR · {100 - nearPercentage}%{" "}
                        {preferences.preferredToken}
                      </p>
                    </div>
                    <span className="font-mono text-sm">{nearPercentage}%</span>
                  </div>
                  <input
                    className="mt-5 w-full accent-[#315b38]"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={nearPercentage}
                    onChange={(event) => setNearPercentage(Number(event.target.value))}
                    aria-label="Percentage delivered on NEAR"
                  />
                </div>
              )}

              <button
                type="button"
                className="button-primary mt-6 w-full"
                disabled={
                  registrationChecking ||
                  !preferences.displayName.trim() ||
                  !preferences.walletAddress.trim()
                }
                onClick={() => void submitRegistration()}
              >
                <Send className="h-4 w-4" />
                {registrationChecking ? "Checking registration…" : "Check and prepare registration"}
              </button>
              {submitted && (
                <div className="mt-5 rounded-2xl bg-acid/45 p-5 text-sm leading-6">
                  <p className="font-semibold">You are not on an onchain roster yet.</p>
                  <p className="mt-1 text-ink/65">
                    Send the wallet card to your employer and ask them to add it from their
                    Clavis business dashboard.
                  </p>
                </div>
              )}
            </section>

            <WalletShareCard accountId={accountId} onCopy={() => void copyWallet()} />
          </div>
        </div>
      </AppShell>
    );
  }

  const recipient = profile.recipient;
  const currentSplits = recipient.payment_split.length
    ? recipient.payment_split
    : [
        {
          chain: recipient.preferred_chain,
          token: recipient.preferred_token,
          percentage: 100,
        },
      ];

  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-5 lg:px-10 lg:py-16">
        <div>
          <p className="eyebrow">Worker portal</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Hello, {recipient.name}.
          </h1>
          <p className="mt-3 text-sm text-ink/50">
            Registered on <span className="font-mono text-xs">{profile.contractId}</span>.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 space-y-6">
            <section className="overflow-hidden rounded-[30px] bg-ink p-6 text-white sm:p-7 lg:p-9">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-acid">
                    Next payment
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-semibold">
                    {recipient.schedule} cycle
                  </h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    recipient.active
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-red-400/10 text-red-300"
                  }`}
                >
                  {recipient.active ? "Active" : "Suspended"}
                </span>
              </div>
              <div className="mt-8 [&>div>div]:bg-white/10">
                <CountdownTimer targetTimestamp={recipient.next_payment_at} />
              </div>
              <div className="mt-8 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-white/35">Primary route</p>
                  <p className="mt-2 text-sm font-semibold">
                    {chainLabel(recipient.preferred_chain)} · {recipient.preferred_token}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/35">Last authorization</p>
                  <p className="mt-2 text-sm font-semibold">
                    {recipient.last_paid
                      ? formatTimestamp(recipient.last_paid)
                      : "Not paid yet"}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center gap-3">
                <Eye className="h-5 w-5 text-moss" />
                <div>
                  <p className="eyebrow">Payment history</p>
                  <p className="mt-1 text-xs text-ink/45">
                    Public policy decisions for your employer contract; salary data stays
                    private.
                  </p>
                </div>
              </div>
              <PaymentHistory
                entries={profile.auditLog}
                contractId={profile.contractId}
                pageSize={6}
              />
            </section>
          </div>

          <aside className="min-w-0 space-y-6">
            <section className="panel p-6 lg:p-8">
              <p className="eyebrow">Local preferences</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">
                Request a route update
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-ink/50">
                  Chain
                  <select
                    className="field mt-2"
                    value={preferences.preferredChain}
                    onChange={(event) => updateChain(event.target.value as Chain)}
                  >
                    <option value="near">NEAR</option>
                    <option value="ethereum">Ethereum</option>
                    <option value="bnb">BNB Chain</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-ink/50">
                  Token
                  <input className="field mt-2" value={preferences.preferredToken} disabled />
                </label>
              </div>
              {preferences.preferredChain !== "near" && (
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-ink/50">
                    <span>NEAR split</span>
                    <span>{nearPercentage}%</span>
                  </div>
                  <input
                    className="mt-3 w-full accent-[#315b38]"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={nearPercentage}
                    onChange={(event) => setNearPercentage(Number(event.target.value))}
                  />
                </div>
              )}
              <button
                type="button"
                className="button-primary mt-5 w-full"
                onClick={() =>
                  savePreferences(
                    "Preferences saved locally — ask your employer to approve the update",
                  )
                }
              >
                <Save className="h-4 w-4" /> Save preferences
              </button>
              <p className="mt-3 text-xs leading-5 text-ink/40">
                Your employer must sign the matching contract update before it affects
                payroll.
              </p>
            </section>
            <PaymentSplit splits={currentSplits} />
            <div className="rounded-[28px] bg-acid p-7">
              <Route className="h-6 w-6" />
              <h3 className="mt-8 font-display text-3xl font-semibold">
                One policy. Multiple chains.
              </h3>
              <p className="mt-3 text-sm leading-6 text-ink/60">
                Your employer authorizes one private payment; Clavis handles each registered
                route.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function WalletShareCard({
  accountId,
  onCopy,
}: {
  accountId: string;
  onCopy: () => void;
}) {
  return (
    <aside className="rounded-[30px] bg-ink p-7 text-white">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-acid text-ink">
          <WalletCards className="h-5 w-5" />
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-acid">
            Share with employer
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">My NEAR wallet</h2>
        </div>
      </div>
      <div className="mx-auto mt-7 w-fit rounded-3xl bg-white p-4">
        <QRCodeSVG value={accountId} size={180} level="M" />
      </div>
      <div className="mt-6 break-all rounded-2xl border border-white/10 bg-white/5 p-4 text-center font-mono text-xs">
        {accountId}
      </div>
      <button
        type="button"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-acid px-5 py-3 text-sm font-bold text-ink"
        onClick={onCopy}
      >
        <Clipboard className="h-4 w-4" /> Copy wallet address
      </button>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-white/45">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acid" />
        Your employer hashes this address before adding it to the payroll contract.
      </p>
    </aside>
  );
}

function loadPreferences(accountId: string): WorkerPreferences | null {
  const value = window.localStorage.getItem(`clavis.workerPreferences.${accountId}`);
  if (!value) return null;
  try {
    return JSON.parse(value) as WorkerPreferences;
  } catch {
    return null;
  }
}

function nearSplitPercentage(splits: SplitConfig[], preferredChain: Chain): number {
  if (preferredChain === "near") return 0;
  return splits
    .filter((split) => split.chain === "near")
    .reduce((total, split) => total + split.percentage, 0);
}
