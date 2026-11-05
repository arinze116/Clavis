import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Building2,
  Check,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  Plus,
  Rocket,
  ShieldCheck,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import {
  isSupportedRecipientRoute,
  RecipientFormFields,
} from "../components/RecipientFormFields";
import { LoadingState } from "../components/ScreenState";
import { WalletButton } from "../components/WalletButton";
import { useToast } from "../contexts/ToastContext";
import { useWallet } from "../contexts/WalletContext";
import { useOwnerContract } from "../hooks/useContractState";
import type { RecipientDraft } from "../types";
import {
  addRecipients,
  createPayroll,
  isBusinessNameAvailable,
  storeContractId,
  waitForPayrollDeployment,
} from "../utils/contract";
import { nearToYocto } from "../utils/format";
import { generatePolicy, type AiPolicyResult } from "../utils/nearAi";
import {
  syncPayrollPlan,
  validateAgentRecipientDraft,
} from "../utils/payrollPlans";

const emptyRecipient: RecipientDraft = {
  name: "",
  walletAddress: "",
  personalCapNear: "",
  paymentAmountNear: "",
  destinationAddress: "",
  preferredChain: "near",
  preferredToken: "NEAR",
  schedule: "Weekly",
};
const steps = ["Wallet", "Business", "Limits", "Recipients", "Agent", "Deploy", "Success"];
const nearAccountPattern = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const maxU128 = (1n << 128n) - 1n;

export default function SetupWizard() {
  const navigate = useNavigate();
  const { showToast, updateToast } = useToast();
  const { accountId, wallet, loading: walletLoading } = useWallet();
  // Only factory deployments should block a wallet from creating a new business contract.
  const ownerContract = useOwnerContract(accountId, false);
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const [dailyLimit, setDailyLimit] = useState("100");
  const [perPaymentLimit, setPerPaymentLimit] = useState("20");
  const [policyDescription, setPolicyDescription] = useState("");
  const [policyResult, setPolicyResult] = useState<AiPolicyResult | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [agent, setAgent] = useState("clavis-agent.testnet");
  const [recipients, setRecipients] = useState<RecipientDraft[]>([]);
  const [draft, setDraft] = useState<RecipientDraft>(emptyRecipient);
  const [deploying, setDeploying] = useState(false);
  const [deployedContractId, setDeployedContractId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedName = businessName.trim().toLowerCase();
  const dailyLimitYocto = parsePositiveYocto(dailyLimit);
  const perPaymentLimitYocto = parsePositiveYocto(perPaymentLimit);
  const limitsValid =
    dailyLimitYocto !== null &&
    perPaymentLimitYocto !== null &&
    perPaymentLimitYocto < dailyLimitYocto;
  const estimatedPayments = useMemo(() => {
    const daily = parsePositiveYocto(dailyLimit);
    const payment = parsePositiveYocto(perPaymentLimit);
    return daily && payment ? (daily / payment).toLocaleString() : "0";
  }, [dailyLimit, perPaymentLimit]);

  useEffect(() => {
    setNameAvailable(null);
    setNameError(null);
    if (!/^(?!-)[a-z0-9-]{2,32}(?<!-)$/.test(normalizedName)) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setCheckingName(true);
      void isBusinessNameAvailable(normalizedName)
        .then((available) => {
          if (active) setNameAvailable(available);
        })
        .catch((reason: unknown) => {
          if (active) {
            setNameAvailable(null);
            setNameError(
              reason instanceof Error
                ? reason.message
                : "Unable to check availability right now.",
            );
          }
        })
        .finally(() => {
          if (active) setCheckingName(false);
        });
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [normalizedName]);

  useEffect(() => {
    if (step !== 6 || !deployedContractId) return;
    const timer = window.setTimeout(() => navigate("/dashboard", { replace: true }), 5_000);
    return () => window.clearTimeout(timer);
  }, [deployedContractId, navigate, step]);

  useEffect(() => {
    if (!policyResult || !draft.name.trim()) return;
    const normalizedName = draft.name.trim().toLowerCase();
    const matchingCap = policyResult.recipient_caps.find(
      (recipient) => recipient.name.trim().toLowerCase() === normalizedName,
    );
    if (!matchingCap) return;
    setDraft((current) => {
      if (
        current.name.trim().toLowerCase() !== normalizedName ||
        current.personalCapNear.trim()
      ) {
        return current;
      }
      return { ...current, personalCapNear: formatAiAmount(matchingCap.cap) };
    });
  }, [draft.name, policyResult]);

  if (walletLoading || ownerContract.loading) {
    return (
      <AppShell>
        <LoadingState label="Preparing business setup" />
      </AppShell>
    );
  }

  async function generateRules() {
    if (policyDescription.trim().length < 10) {
      setPolicyError("Describe the limits, schedule, or recipient caps you want Clavis to enforce.");
      return;
    }
    setPolicyBusy(true);
    setPolicyError(null);
    try {
      const result = await generatePolicy(policyDescription.trim());
      setPolicyResult(result);
      if (result.daily_limit !== null) setDailyLimit(formatAiAmount(result.daily_limit));
      if (result.per_payment_limit !== null) {
        setPerPaymentLimit(formatAiAmount(result.per_payment_limit));
      }
      if (result.schedule) {
        setDraft((current) => ({ ...current, schedule: result.schedule ?? current.schedule }));
      }
    } catch (reason) {
      setPolicyError(reason instanceof Error ? reason.message : "Unable to generate payroll rules");
    } finally {
      setPolicyBusy(false);
    }
  }

  function addDraft(event?: React.FormEvent) {
    event?.preventDefault();
    if (
      !draft.name.trim() ||
      !draft.walletAddress.trim() ||
      !draft.personalCapNear.trim() ||
      !draft.paymentAmountNear.trim()
    ) {
      setError("Complete the recipient name, wallet, scheduled payment, and personal cap.");
      return;
    }
    if (
      parsePositiveYocto(draft.personalCapNear) === null
    ) {
      setError("Recipient personal cap must be greater than zero.");
      return;
    }
    if (!isSupportedRecipientRoute(draft)) {
      setError("Choose a supported chain and token route.");
      return;
    }
    const agentValidationError = validateAgentRecipientDraft(draft, perPaymentLimit);
    if (agentValidationError) {
      setError(agentValidationError);
      return;
    }
    const walletAddress = draft.walletAddress.trim().toLowerCase();
    if (!nearAccountPattern.test(walletAddress)) {
      setError("Enter a valid NEAR testnet account for the worker.");
      return;
    }
    if (
      recipients.some(
        (recipient) => recipient.walletAddress.trim().toLowerCase() === walletAddress,
      )
    ) {
      setError("That worker wallet is already in the setup roster.");
      return;
    }
    setRecipients((value) => [
      ...value,
      {
        ...draft,
        walletAddress,
        name: draft.name.trim(),
        region: draft.region?.trim() ?? "",
      },
    ]);
    setDraft({
      ...emptyRecipient,
      schedule: policyResult?.schedule ?? emptyRecipient.schedule,
    });
    setError(null);
  }

  function canContinue(): boolean {
    if (step === 0) return Boolean(accountId && wallet && !ownerContract.contract);
    if (step === 1) return nameAvailable === true && !checkingName;
    if (step === 2) return limitsValid;
    if (step === 4) return nearAccountPattern.test(agent.trim().toLowerCase());
    return true;
  }

  async function deploy() {
    if (!wallet || !accountId || nameAvailable !== true || !limitsValid) return;
    setDeploying(true);
    setError(null);
    const contractId = `${normalizedName}.clavis.testnet`;
    let activeToastId = showToast({ status: "pending", message: "Transaction submitted" });
    try {
      const deployment = await createPayroll({
        wallet,
        accountId,
        name: normalizedName,
        agent,
        dailyLimitNear: dailyLimit,
        perPaymentLimitNear: perPaymentLimit,
      });
      const record = await waitForPayrollDeployment(accountId, contractId);
      storeContractId(record.contract_id);
      updateToast(activeToastId, {
        status: "success",
        message: "Transaction confirmed ✅ — Payroll contract deployed",
        explorerHref: deployment.explorerHref,
      });
      activeToastId = showToast({
        status: "pending",
        message: "Authorizing private payroll plan",
      });
      await syncPayrollPlan({
        wallet,
        accountId,
        contractId,
        recipients,
      });
      updateToast(activeToastId, {
        status: "success",
        message: "Payroll agent configured ✅",
      });
      if (recipients.length > 0) {
        activeToastId = showToast({ status: "pending", message: "Transaction submitted" });
        const recipientTransactions = await addRecipients(
          wallet,
          accountId,
          contractId,
          recipients,
        );
        updateToast(activeToastId, {
          status: "success",
          message: "Transaction confirmed ✅ — Payroll recipients added",
          explorerHref: recipientTransactions.at(-1)?.explorerHref,
        });
      }
      setDeployedContractId(record.contract_id);
      setStep(6);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Deployment failed";
      setError(detail);
      updateToast(activeToastId, {
        status: "error",
        message: `Setup failed ❌ — ${detail}`,
      });
    } finally {
      setDeploying(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1080px] px-4 py-10 sm:px-5 lg:px-10 lg:py-16">
        <div className="text-center">
          <p className="eyebrow">Owner onboarding</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Launch your payroll contract.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink/50">
            The factory creates an isolated contract under clavis.testnet with your wallet as
            owner. Deployment uses testnet funds only.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-3xl sm:hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-ink/45">
              Step {step + 1} of {steps.length}
            </span>
            <span className="font-semibold text-ink">{steps[step]}</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full w-full origin-left rounded-full bg-ink transition-transform duration-300"
              style={{ transform: `scaleX(${(step + 1) / steps.length})` }}
            />
          </div>
        </div>

        <div className="mx-auto mt-9 hidden max-w-4xl overflow-x-auto pb-2 sm:block">
          <div className="flex min-w-[650px] items-center justify-between">
            {steps.map((label, index) => (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div className="grid justify-items-center gap-2">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${
                      index <= step
                        ? "bg-ink text-acid"
                        : "border border-line bg-white text-ink/35"
                    }`}
                  >
                    {index < step ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-ink/40">
                    {label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <span
                    className={`mx-2 h-px flex-1 ${index < step ? "bg-ink" : "bg-line"}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="panel mx-auto mt-7 max-w-3xl p-5 sm:p-9">
          {step === 0 && (
            <div className="text-center">
              <WalletCards className="mx-auto h-9 w-9 text-moss" />
              <h2 className="mt-5 font-display text-3xl font-semibold">
                Connect the owner wallet
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/50">
                This account owns policy, recipients, and emergency controls for the new
                contract.
              </p>
              <div className="mt-7 flex justify-center">
                <WalletButton />
              </div>
              {ownerContract.contract && (
                <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  This wallet already owns{" "}
                  <span className="font-mono text-xs">
                    {ownerContract.contract.contract_id}
                  </span>
                  .{" "}
                  <Link to="/dashboard" className="font-semibold underline">
                    Open its dashboard
                  </Link>
                  .
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <Building2 className="h-8 w-8 text-moss" />
              <h2 className="mt-5 font-display text-3xl font-semibold">
                Choose your business name
              </h2>
              <p className="mt-2 text-sm text-ink/50">
                Lowercase letters, numbers, and hyphens only. This becomes your permanent
                testnet account.
              </p>
              <label className="mt-7 block text-xs font-semibold text-ink/50">
                Business name
                <div className="mt-2 flex items-center rounded-2xl border border-line bg-white">
                  <input
                    className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3 text-sm outline-none"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    placeholder="acmecorp"
                    autoComplete="organization"
                  />
                  <span className="pr-4 font-mono text-xs text-ink/40">.clavis.testnet</span>
                </div>
              </label>
              <p
                className={`mt-3 text-xs ${
                  nameAvailable === true
                    ? "text-emerald-700"
                    : nameAvailable === false
                      ? "text-red-700"
                      : "text-ink/40"
                }`}
              >
                {checkingName
                  ? "Checking availability…"
                  : nameError
                    ? nameError
                  : nameAvailable === true
                    ? "Available — this name is ready to deploy."
                    : nameAvailable === false
                      ? "Unavailable or invalid. Try another name."
                      : "Enter 2–32 valid characters."}
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <ShieldCheck className="h-8 w-8 text-moss" />
              <h2 className="mt-5 font-display text-3xl font-semibold">
                Set treasury limits
              </h2>
              <p className="mt-2 text-sm text-ink/50">
                Both limits are enforced onchain in yoctoNEAR.
              </p>

              <section className="mt-7 rounded-2xl border border-ink/10 bg-canvas/55 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-acid">
                    <BrainCircuit className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">Describe the policy you want</h3>
                    <p className="mt-1 text-xs leading-5 text-ink/50">
                      NEAR AI turns plain English into editable contract limits and roster defaults.
                    </p>
                  </div>
                </div>
                <label
                  className="mt-4 block text-xs font-semibold text-ink/55"
                  htmlFor="setup-policy-description"
                >
                  Payroll rules
                  <textarea
                    id="setup-policy-description"
                    className="field mt-2 min-h-32 resize-y leading-6"
                    value={policyDescription}
                    onChange={(event) => {
                      setPolicyDescription(event.target.value);
                      setPolicyError(null);
                    }}
                    placeholder="Describe your payroll rules in plain English. e.g. Pay Sarah $500 weekly on Fridays, max $600 per day total, never pay between midnight and 6am"
                    maxLength={2_500}
                    disabled={policyBusy}
                  />
                </label>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[11px] text-ink/35">
                    {policyDescription.length.toLocaleString()}/2,500 characters
                  </span>
                  <button
                    type="button"
                    className="button-primary w-full sm:w-auto"
                    onClick={() => void generateRules()}
                    disabled={policyBusy || policyDescription.trim().length < 10}
                  >
                    {policyBusy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <BrainCircuit className="h-4 w-4" aria-hidden="true" />
                    )}
                    {policyBusy ? "Generating payroll rules" : "Generate rules with AI"}
                  </button>
                </div>

                {policyError && (
                  <p className="mt-3 text-xs leading-5 text-red-700" role="alert">
                    {policyError}
                  </p>
                )}

                {policyResult && (
                  <div
                    className="mt-5 rounded-xl border border-moss/20 bg-white p-4"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-moss" aria-hidden="true" />
                      <h3 className="text-sm font-semibold">What NEAR AI extracted</h3>
                    </div>
                    <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-ink/40">Daily limit</dt>
                        <dd className="mt-1 font-semibold text-ink">
                          {policyResult.daily_limit === null
                            ? "Not specified"
                            : `${formatAiAmount(policyResult.daily_limit)} NEAR`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink/40">Per payment</dt>
                        <dd className="mt-1 font-semibold text-ink">
                          {policyResult.per_payment_limit === null
                            ? "Not specified"
                            : `${formatAiAmount(policyResult.per_payment_limit)} NEAR`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink/40">Default schedule</dt>
                        <dd className="mt-1 font-semibold text-ink">
                          {policyResult.schedule ?? "Not specified"}
                        </dd>
                      </div>
                    </dl>

                    {policyResult.summary.length > 0 && (
                      <ul className="mt-4 grid gap-2 text-xs leading-5 text-ink/60">
                        {policyResult.summary.map((item, index) => (
                          <li key={`${item}-${index}`} className="flex gap-2">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {policyResult.recipient_caps.length > 0 && (
                      <div className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs leading-5 text-ink/60">
                        <span className="font-semibold text-ink">Recipient caps saved for the next step:</span>{" "}
                        {policyResult.recipient_caps
                          .map((recipient) => `${recipient.name} · ${formatAiAmount(recipient.cap)} NEAR`)
                          .join(", ")}
                      </div>
                    )}

                    {policyResult.warnings.length > 0 && (
                      <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{policyResult.warnings.join(" ")}</span>
                      </div>
                    )}
                    <p className="mt-4 text-[11px] text-ink/40">
                      The fields below are now filled from this draft. Review or edit them before continuing.
                    </p>
                  </div>
                )}
              </section>

              <h3 className="mt-7 text-sm font-semibold">Review treasury limits</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-ink/50">
                  Daily limit (NEAR)
                  <input
                    className="field mt-2"
                    inputMode="decimal"
                    value={dailyLimit}
                    onChange={(event) => setDailyLimit(event.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold text-ink/50">
                  Per-payment limit (NEAR)
                  <input
                    className="field mt-2"
                    inputMode="decimal"
                    value={perPaymentLimit}
                    onChange={(event) => setPerPaymentLimit(event.target.value)}
                  />
                </label>
              </div>
              <div className="mt-5 rounded-2xl bg-acid/55 p-4 text-sm">
                At these limits, no more than <strong>{estimatedPayments} maximum-size payments</strong>{" "}
                can be authorized per day.
              </div>
              {!limitsValid && (
                <p className="mt-3 text-xs text-red-700">
                  Limits must be positive and the per-payment limit must be less than the daily limit.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <Plus className="h-8 w-8 text-moss" />
              <h2 className="mt-5 font-display text-3xl font-semibold">
                Add approved recipients
              </h2>
              <p className="mt-2 text-sm text-ink/50">
                Wallet addresses are hashed in your browser before the contract receives them.
              </p>
              {policyResult &&
                (policyResult.schedule || policyResult.recipient_caps.length > 0) && (
                  <div className="mt-5 rounded-xl border border-moss/20 bg-canvas/55 px-4 py-3 text-xs leading-5 text-ink/60">
                    <span className="font-semibold text-ink">AI defaults are active.</span>{" "}
                    {policyResult.schedule && `${policyResult.schedule} schedule. `}
                    {policyResult.recipient_caps.length > 0 &&
                      "Type an extracted recipient name exactly to apply the saved cap; every value remains editable."}
                  </div>
                )}
              <form className="mt-6 grid gap-4" onSubmit={addDraft}>
                <RecipientFormFields
                  idPrefix="setup-recipient"
                  value={draft}
                  onChange={setDraft}
                  disabled={recipients.length >= 20}
                />
                <button
                  type="submit"
                  className="button-secondary w-full"
                  disabled={recipients.length >= 20}
                >
                  <Plus className="h-4 w-4" /> Add to setup
                </button>
              </form>
              <div className="mt-5 space-y-2">
                {recipients.map((recipient, index) => (
                  <div
                    key={`${recipient.walletAddress}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-canvas p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{recipient.name}</p>
                      <p className="mt-1 truncate text-xs text-ink/40">
                        {recipient.walletAddress} · {recipient.preferredChain}/{recipient.preferredToken} ·{" "}
                        {recipient.personalCapNear} NEAR cap · {recipient.schedule}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-red-600"
                      onClick={() =>
                        setRecipients((value) =>
                          value.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      aria-label={`Remove ${recipient.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <KeyRound className="h-8 w-8 text-moss" />
              <h2 className="mt-5 font-display text-3xl font-semibold">
                Set the payroll agent
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/50">
                This testnet account may request payments. It cannot change owner policy.
              </p>
              <label className="mt-7 block text-xs font-semibold text-ink/50">
                Agent account
                <input
                  className="field mt-2 font-mono text-xs"
                  value={agent}
                  onChange={(event) => setAgent(event.target.value)}
                />
              </label>
              {!nearAccountPattern.test(agent.trim().toLowerCase()) && (
                <p className="mt-3 text-xs text-red-700">
                  Enter a valid NEAR testnet agent account.
                </p>
              )}
            </div>
          )}

          {step === 5 && (
            <div>
              <Rocket className="h-8 w-8 text-moss" />
              <h2 className="mt-5 font-display text-3xl font-semibold">
                Deploy on NEAR testnet
              </h2>
              <div className="mt-7 divide-y divide-line rounded-2xl border border-line">
                {[
                  ["Contract", `${normalizedName}.clavis.testnet`],
                  ["Owner", accountId ?? "Not connected"],
                  ["Daily limit", `${dailyLimit} NEAR`],
                  ["Per-payment limit", `${perPaymentLimit} NEAR`],
                  ["Recipients", String(recipients.length)],
                  ["Agent", agent],
                  ["Deployment balance", "6 NEAR testnet"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-6 px-4 py-3 text-sm"
                  >
                    <span className="text-ink/45">{label}</span>
                    <span className="truncate text-right font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="button-primary mt-6 w-full"
                disabled={deploying || !wallet}
                onClick={() => void deploy()}
              >
                {deploying ? "Deploying and configuring…" : "Deploy payroll contract"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-center text-xs text-ink/40">
                Your wallet may request additional signatures to add the initial roster.
              </p>
            </div>
          )}

          {step === 6 && (
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-acid">
                <Check className="h-6 w-6" />
              </span>
              <h2 className="mt-5 font-display text-4xl font-semibold">Your contract is live.</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink/50">
                Clavis created and initialized your isolated payroll contract. Fund its
                treasury, confirm your offchain payroll plan, and keep the agent online.
                You will be redirected to the business dashboard in a few seconds.
              </p>
              <div className="mt-6 rounded-2xl bg-canvas p-4 font-mono text-sm">
                {deployedContractId}
              </div>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => navigate("/dashboard")}
                >
                  Open business dashboard <ArrowRight className="h-4 w-4" />
                </button>
                <Link to="/worker" className="button-secondary">
                  Open worker portal
                </Link>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700">
              {error}
            </p>
          )}

          {step < 6 && (
            <div className="mt-9 flex items-center justify-between border-t border-line pt-5">
              <button
                type="button"
                className="button-secondary"
                disabled={step === 0 || deploying}
                onClick={() => setStep((value) => value - 1)}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {step < 5 && (
                <button
                  type="button"
                  className="button-primary"
                  disabled={!canContinue() || deploying}
                  onClick={() => setStep((value) => value + 1)}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function parsePositiveYocto(value: string): bigint | null {
  try {
    const yocto = BigInt(nearToYocto(value));
    return yocto > 0n && yocto <= maxU128 ? yocto : null;
  } catch {
    return null;
  }
}

function formatAiAmount(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, "");
}
