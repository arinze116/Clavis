import { Plus, Save, Shield } from "lucide-react";
import { useEffect, useState } from "react";

import type { RecipientDraft } from "../types";
import {
  isPositiveNearAmount,
  isValidNearAccountId,
  nearToYocto,
  yoctoToNearInput,
} from "../utils/format";
import { validateAgentRecipientDraft } from "../utils/payrollPlans";
import { Modal } from "./Modal";
import {
  isSupportedRecipientRoute,
  RecipientFormFields,
} from "./RecipientFormFields";

interface RulesPanelProps {
  dailyLimit: string;
  perPaymentLimit: string;
  agent: string;
  busy: boolean;
  onUpdateLimits: (dailyNear: string, perPaymentNear: string) => Promise<void>;
  onUpdateAgent: (agent: string) => Promise<void>;
  onAddRecipient: (draft: RecipientDraft) => Promise<void>;
}

const initialRecipient: RecipientDraft = {
  name: "",
  walletAddress: "",
  personalCapNear: "",
  paymentAmountNear: "",
  destinationAddress: "",
  preferredChain: "near",
  preferredToken: "NEAR",
  schedule: "Weekly",
};

export function RulesPanel(props: RulesPanelProps) {
  const [daily, setDaily] = useState(() => yoctoToNearInput(props.dailyLimit));
  const [perPayment, setPerPayment] = useState(() => yoctoToNearInput(props.perPaymentLimit));
  const [agent, setAgent] = useState(props.agent);
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [recipient, setRecipient] = useState<RecipientDraft>(initialRecipient);
  const [limitsError, setLimitsError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  useEffect(() => setDaily(yoctoToNearInput(props.dailyLimit)), [props.dailyLimit]);
  useEffect(
    () => setPerPayment(yoctoToNearInput(props.perPaymentLimit)),
    [props.perPaymentLimit],
  );
  useEffect(() => setAgent(props.agent), [props.agent]);

  async function submitLimits(event: React.FormEvent) {
    event.preventDefault();
    setLimitsError(null);
    if (!isPositiveNearAmount(daily) || !isPositiveNearAmount(perPayment)) {
      setLimitsError("Both limits must be positive NEAR amounts.");
      return;
    }
    if (BigInt(nearToYocto(perPayment)) >= BigInt(nearToYocto(daily))) {
      setLimitsError("The per-payment limit must be less than the daily limit.");
      return;
    }
    try {
      await props.onUpdateLimits(daily, perPayment);
    } catch (error) {
      setLimitsError(error instanceof Error ? error.message : "Unable to update limits");
    }
  }

  async function submitAgent(event: React.FormEvent) {
    event.preventDefault();
    setAgentError(null);
    const normalized = agent.trim();
    if (!isValidNearAccountId(normalized)) {
      setAgentError("Enter a valid lowercase NEAR testnet account ID.");
      return;
    }
    try {
      await props.onUpdateAgent(normalized);
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "Unable to update agent");
    }
  }

  async function submitRecipient(event: React.FormEvent) {
    event.preventDefault();
    setRecipientError(null);
    const walletAddress = recipient.walletAddress.trim().toLowerCase();
    if (!recipient.name.trim()) {
      setRecipientError("Enter the recipient's display name.");
      return;
    }
    if (!isValidNearAccountId(walletAddress)) {
      setRecipientError("Enter a valid lowercase NEAR testnet wallet address.");
      return;
    }
    if (!isPositiveNearAmount(recipient.personalCapNear)) {
      setRecipientError("The personal cap must be a positive NEAR amount.");
      return;
    }
    if (!isSupportedRecipientRoute(recipient)) {
      setRecipientError("Choose a supported chain and token pair.");
      return;
    }
    const agentValidationError = validateAgentRecipientDraft(
      recipient,
      yoctoToNearInput(props.perPaymentLimit),
    );
    if (agentValidationError) {
      setRecipientError(agentValidationError);
      return;
    }
    try {
      await props.onAddRecipient({
        ...recipient,
        name: recipient.name.trim(),
        walletAddress,
        ...(recipient.region?.trim() ? { region: recipient.region.trim() } : {}),
      });
      setRecipient(initialRecipient);
      setRecipientOpen(false);
    } catch (error) {
      setRecipientError(error instanceof Error ? error.message : "Unable to add recipient");
    }
  }

  return (
    <section className="panel p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Policy controls</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Rules engine</h2>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-canvas">
          <Shield className="h-4 w-4 text-moss" />
        </span>
      </div>

      <form
        className="mt-7 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => void submitLimits(event)}
      >
        <label className="text-xs font-semibold text-ink/55">
          Daily limit (NEAR)
          <input
            className="field mt-2"
            value={daily}
            onChange={(event) => setDaily(event.target.value)}
            inputMode="decimal"
            disabled={props.busy}
            required
          />
        </label>
        <label className="text-xs font-semibold text-ink/55">
          Per-payment limit (NEAR)
          <input
            className="field mt-2"
            value={perPayment}
            onChange={(event) => setPerPayment(event.target.value)}
            inputMode="decimal"
            disabled={props.busy}
            required
          />
        </label>
        {limitsError && (
          <p className="text-xs leading-5 text-red-700 sm:col-span-2" role="alert">
            {limitsError}
          </p>
        )}
        <button type="submit" className="button-secondary sm:col-span-2" disabled={props.busy}>
          <Save className="h-4 w-4" /> Save treasury limits
        </button>
      </form>

      <div className="my-7 h-px bg-line" />

      <form onSubmit={(event) => void submitAgent(event)}>
        <label className="text-xs font-semibold text-ink/55">
          Authorized agent account
          <input
            className="field mt-2 font-mono text-xs"
            value={agent}
            onChange={(event) => setAgent(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={props.busy}
            required
          />
        </label>
        {agentError && (
          <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
            {agentError}
          </p>
        )}
        <button
          type="submit"
          className="button-secondary mt-3 w-full"
          disabled={props.busy || agent.trim() === props.agent}
        >
          Update agent address
        </button>
      </form>

      <button
        type="button"
        className="button-primary mt-4 w-full"
        onClick={() => {
          setRecipientError(null);
          setRecipientOpen(true);
        }}
      >
        <Plus className="h-4 w-4" /> Add recipient
      </button>

      {recipientOpen && (
        <Modal
          title="Add a payroll recipient"
          description="Wallet addresses are hashed locally before the recipient policy is written on-chain."
          onClose={() => setRecipientOpen(false)}
          size="lg"
        >
          <form onSubmit={(event) => void submitRecipient(event)}>
            <RecipientFormFields
              value={recipient}
              onChange={setRecipient}
              disabled={props.busy}
              idPrefix="dashboard-recipient"
            />
            {recipientError && (
              <p
                className="mt-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {recipientError}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setRecipientOpen(false)}
                disabled={props.busy}
              >
                Cancel
              </button>
              <button type="submit" className="button-primary" disabled={props.busy}>
                Add recipient
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
