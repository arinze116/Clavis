import { Plus, Save, Shield } from "lucide-react";
import { useEffect, useState } from "react";

import type { RecipientDraft } from "../types";
import { formatNear } from "../utils/format";

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
  preferredChain: "near",
  preferredToken: "NEAR",
  schedule: "Weekly",
};

export function RulesPanel(props: RulesPanelProps) {
  const [daily, setDaily] = useState("");
  const [perPayment, setPerPayment] = useState("");
  const [agent, setAgent] = useState(props.agent);
  const [showRecipient, setShowRecipient] = useState(false);
  const [recipient, setRecipient] = useState<RecipientDraft>(initialRecipient);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setAgent(props.agent), [props.agent]);

  async function submitLimits(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await props.onUpdateLimits(daily, perPayment);
      setDaily("");
      setPerPayment("");
      setMessage("Limits updated successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update limits");
    }
  }

  async function submitAgent(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await props.onUpdateAgent(agent);
      setMessage("Agent address updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update agent");
    }
  }

  async function submitRecipient(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await props.onAddRecipient(recipient);
      setRecipient(initialRecipient);
      setShowRecipient(false);
      setMessage("Recipient added to the allowlist.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add recipient");
    }
  }

  return (
    <section className="panel p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Policy controls</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Rules engine</h2>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-canvas"><Shield className="h-5 w-5 text-moss" /></span>
      </div>

      <form className="mt-7 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submitLimits(event)}>
        <label className="text-xs font-semibold text-ink/55">
          Daily limit
          <input className="field mt-2" value={daily} onChange={(event) => setDaily(event.target.value)} placeholder={formatNear(props.dailyLimit).replace(" NEAR", "")} inputMode="decimal" required />
        </label>
        <label className="text-xs font-semibold text-ink/55">
          Per-payment limit
          <input className="field mt-2" value={perPayment} onChange={(event) => setPerPayment(event.target.value)} placeholder={formatNear(props.perPaymentLimit).replace(" NEAR", "")} inputMode="decimal" required />
        </label>
        <button type="submit" className="button-secondary sm:col-span-2" disabled={props.busy}>
          <Save className="h-4 w-4" /> Save treasury limits
        </button>
      </form>

      <div className="my-7 h-px bg-line" />

      <form onSubmit={(event) => void submitAgent(event)}>
        <label className="text-xs font-semibold text-ink/55">
          Authorized agent account
          <input className="field mt-2 font-mono text-xs" value={agent} onChange={(event) => setAgent(event.target.value)} required />
        </label>
        <button type="submit" className="button-secondary mt-3 w-full" disabled={props.busy || agent === props.agent}>Update agent address</button>
      </form>

      <button type="button" className="button-primary mt-4 w-full" onClick={() => setShowRecipient((value) => !value)}>
        <Plus className="h-4 w-4" /> Add recipient
      </button>

      {showRecipient && (
        <form className="mt-5 grid gap-3 rounded-2xl border border-line bg-canvas/60 p-4" onSubmit={(event) => void submitRecipient(event)}>
          <input className="field" placeholder="Display name" value={recipient.name} onChange={(event) => setRecipient({ ...recipient, name: event.target.value })} required />
          <input className="field font-mono text-xs" placeholder="Wallet address (hashed locally)" value={recipient.walletAddress} onChange={(event) => setRecipient({ ...recipient, walletAddress: event.target.value })} required />
          <input className="field" placeholder="Personal cap in NEAR" inputMode="decimal" value={recipient.personalCapNear} onChange={(event) => setRecipient({ ...recipient, personalCapNear: event.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <select className="field" value={recipient.preferredChain} onChange={(event) => {
              const chain = event.target.value as RecipientDraft["preferredChain"];
              const token = chain === "near" ? "NEAR" : chain === "ethereum" ? "USDC" : "BUSD";
              setRecipient({ ...recipient, preferredChain: chain, preferredToken: token });
            }}>
              <option value="near">NEAR</option><option value="ethereum">Ethereum</option><option value="bnb">BNB Chain</option>
            </select>
            <select className="field" value={recipient.schedule} onChange={(event) => setRecipient({ ...recipient, schedule: event.target.value as RecipientDraft["schedule"] })}>
              <option value="Weekly">Weekly</option><option value="Biweekly">Biweekly</option><option value="Milestone">Milestone</option>
            </select>
          </div>
          <button type="submit" className="button-primary" disabled={props.busy}>Hash & add recipient</button>
        </form>
      )}

      {message && <p className="mt-4 rounded-xl bg-canvas px-3 py-2 text-xs text-ink/60" role="status">{message}</p>}
    </section>
  );
}
