import {
  Info,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import type {
  Chain,
  Recipient,
  RecipientUpdateDraft,
  Token,
} from "../types";
import {
  chainLabel,
  formatNear,
  formatTimestamp,
  isPositiveNearAmount,
  nearToYocto,
  yoctoToNearInput,
} from "../utils/format";
import { validateAgentRecipientDraft } from "../utils/payrollPlans";
import { Modal } from "./Modal";

interface RecipientTableProps {
  recipients: Recipient[];
  perPaymentLimit: string;
  busy: boolean;
  busyHash: string | null;
  onToggle: (recipient: Recipient) => Promise<void>;
  onEdit: (recipient: Recipient, update: RecipientUpdateDraft) => Promise<void>;
  onRemove: (recipient: Recipient) => Promise<void>;
}

const tokenByChain: Record<Chain, Token> = {
  near: "NEAR",
  ethereum: "USDC",
  bnb: "BUSD",
};

export function RecipientTable({
  recipients,
  perPaymentLimit,
  busy,
  busyHash,
  onToggle,
  onEdit,
  onRemove,
}: RecipientTableProps) {
  const [editing, setEditing] = useState<Recipient | null>(null);
  const [editValue, setEditValue] = useState<RecipientUpdateDraft | null>(null);
  const [removing, setRemoving] = useState<Recipient | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  function openEdit(recipient: Recipient) {
    setEditing(recipient);
    setEditValue({
      personalCapNear: yoctoToNearInput(recipient.personal_cap),
      walletAddress: "",
      paymentAmountNear: "",
      destinationAddress: "",
      preferredChain: recipient.preferred_chain,
      preferredToken: recipient.preferred_token,
      schedule: recipient.schedule,
      active: recipient.active,
      updatePrivatePlan: false,
    });
    setEditError(null);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || !editValue) return;
    setEditError(null);
    if (!isPositiveNearAmount(editValue.personalCapNear)) {
      setEditError("The personal cap must be a positive NEAR amount.");
      return;
    }
    if (tokenByChain[editValue.preferredChain] !== editValue.preferredToken) {
      setEditError("Choose a supported chain and token pair.");
      return;
    }
    if (privatePlanRefreshRequired(editing, editValue) || editValue.updatePrivatePlan) {
      const privatePlanError = validateAgentRecipientDraft(
        {
          name: editing.name,
          walletAddress: editValue.walletAddress,
          personalCapNear: editValue.personalCapNear,
          paymentAmountNear: editValue.paymentAmountNear,
          destinationAddress: editValue.destinationAddress,
          preferredChain: editValue.preferredChain,
          preferredToken: editValue.preferredToken,
          schedule: editValue.schedule,
        },
        yoctoToNearInput(perPaymentLimit),
      );
      if (privatePlanError) {
        setEditError(privatePlanError);
        return;
      }
    }
    try {
      await onEdit(editing, editValue);
      setEditing(null);
      setEditValue(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to update recipient");
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveError(null);
    try {
      await onRemove(removing);
      setRemoving(null);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : "Unable to remove recipient");
    }
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-5 sm:px-6 lg:px-8">
        <div>
          <p className="eyebrow">Approved recipients</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Your payroll roster</h2>
        </div>
        <span className="font-mono text-xs text-ink/45">{recipients.length}/20</span>
      </div>

      <div className="grid gap-3 p-4 sm:hidden">
        {recipients.map((recipient) => (
          <article key={recipient.recipient_hash} className="rounded-[16px] border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-ink text-xs font-semibold text-acid">
                  {recipient.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{recipient.name}</p>
                  <p className="mt-1 text-xs text-ink/45">
                    {chainLabel(recipient.preferred_chain)} · {recipient.preferred_token}
                  </p>
                </div>
              </div>
              <Status active={recipient.active} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-ink/40">Personal cap</dt>
                <dd className="mt-1 font-medium">{formatNear(recipient.personal_cap)}</dd>
              </div>
              <div>
                <dt className="text-ink/40">Next payment</dt>
                <dd className="mt-1 text-ink/65">
                  {recipient.next_payment_at
                    ? formatTimestamp(recipient.next_payment_at)
                    : "Manual milestone"}
                </dd>
              </div>
            </dl>
            <RecipientActions
              recipient={recipient}
              busy={busy || busyHash === recipient.recipient_hash}
              onToggle={onToggle}
              onEdit={openEdit}
              onRemove={(value) => {
                setRemoveError(null);
                setRemoving(value);
              }}
              mobile
            />
          </article>
        ))}
        {recipients.length === 0 && <EmptyRoster />}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-canvas/70 text-[11px] text-ink/40">
            <tr>
              <th className="px-6 py-4 font-semibold lg:px-8">Recipient</th>
              <th className="px-4 py-4 font-semibold">Route</th>
              <th className="px-4 py-4 font-semibold">Personal cap</th>
              <th className="px-4 py-4 font-semibold">Next payment</th>
              <th className="px-4 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold lg:px-8">
                <MoreHorizontal className="ml-auto h-4 w-4" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {recipients.map((recipient) => (
              <tr key={recipient.recipient_hash} className="transition-colors hover:bg-canvas/45">
                <td className="px-6 py-4 lg:px-8">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-ink text-xs font-semibold text-acid">
                      {recipient.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium">{recipient.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink/35">
                        {recipient.schedule}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm">
                  {chainLabel(recipient.preferred_chain)} · {recipient.preferred_token}
                </td>
                <td className="px-4 py-4 text-sm font-medium">
                  {formatNear(recipient.personal_cap)}
                </td>
                <td className="px-4 py-4 text-sm text-ink/55">
                  {recipient.next_payment_at
                    ? formatTimestamp(recipient.next_payment_at)
                    : "Manual milestone"}
                </td>
                <td className="px-4 py-4">
                  <Status active={recipient.active} />
                </td>
                <td className="px-6 py-4 lg:px-8">
                  <RecipientActions
                    recipient={recipient}
                    busy={busy || busyHash === recipient.recipient_hash}
                    onToggle={onToggle}
                    onEdit={openEdit}
                    onRemove={(value) => {
                      setRemoveError(null);
                      setRemoving(value);
                    }}
                  />
                </td>
              </tr>
            ))}
            {recipients.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyRoster />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && editValue && (
        <Modal
          title={`Edit ${editing.name}`}
          description="Update this recipient's cap, route, schedule, or payroll status."
          onClose={() => setEditing(null)}
        >
          <form className="grid gap-4" onSubmit={(event) => void saveEdit(event)}>
            <div className="rounded-[12px] border border-line bg-white px-4 py-3">
              <p className="text-sm font-semibold">{editing.name}</p>
              <p className="mt-1 truncate font-mono text-[10px] text-ink/40">
                {editing.recipient_hash}
              </p>
            </div>
            <label className="text-xs font-semibold text-ink/55">
              Personal cap (NEAR)
              <input
                className="field mt-2"
                value={editValue.personalCapNear}
                onChange={(event) =>
                  setEditValue({ ...editValue, personalCapNear: event.target.value })
                }
                inputMode="decimal"
                required
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-ink/55">
                Destination chain
                <select
                  className="field mt-2"
                  value={editValue.preferredChain}
                  onChange={(event) => {
                    const chain = event.target.value as Chain;
                    setEditValue({
                      ...editValue,
                      preferredChain: chain,
                      preferredToken: tokenByChain[chain],
                      destinationAddress: "",
                    });
                  }}
                >
                  <option value="near">NEAR</option>
                  <option value="ethereum">Ethereum</option>
                  <option value="bnb">BNB Chain</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-ink/55">
                Token
                <select
                  className="field mt-2"
                  value={editValue.preferredToken}
                  onChange={(event) =>
                    setEditValue({
                      ...editValue,
                      preferredToken: event.target.value as Token,
                    })
                  }
                >
                  <option value="NEAR">NEAR</option>
                  <option value="USDC">USDC</option>
                  <option value="BUSD">BUSD</option>
                </select>
              </label>
            </div>
            <label className="text-xs font-semibold text-ink/55">
              Schedule
              <select
                className="field mt-2"
                value={editValue.schedule}
                onChange={(event) =>
                  setEditValue({
                    ...editValue,
                    schedule: event.target.value as RecipientUpdateDraft["schedule"],
                  })
                }
              >
                <option value="Weekly">Weekly</option>
                <option value="Biweekly">Biweekly</option>
                <option value="Milestone">Milestone</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-[12px] border border-line bg-white px-4 py-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={editValue.active}
                onChange={(event) =>
                  setEditValue({ ...editValue, active: event.target.checked })
                }
                className="h-4 w-4 accent-moss"
              />
              Recipient is active and eligible for payroll
            </label>
            <label className="flex items-start gap-3 rounded-[12px] border border-line bg-white px-4 py-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={
                  privatePlanRefreshRequired(editing, editValue) ||
                  editValue.updatePrivatePlan
                }
                disabled={privatePlanRefreshRequired(editing, editValue)}
                onChange={(event) =>
                  setEditValue({ ...editValue, updatePrivatePlan: event.target.checked })
                }
                className="mt-0.5 h-4 w-4 accent-moss"
              />
              <span>
                Update the private scheduled amount or delivery address
                <span className="mt-1 block text-xs font-normal leading-5 text-ink/45">
                  Required when the cap or route changes. Private values are never read from or
                  written to the public contract.
                </span>
              </span>
            </label>
            {(privatePlanRefreshRequired(editing, editValue) ||
              editValue.updatePrivatePlan) && (
              <fieldset className="rounded-[14px] border border-moss/20 bg-moss/[0.04] p-4">
                <legend className="px-1 text-xs font-semibold text-moss">
                  Private agent delivery plan
                </legend>
                <p className="mb-4 text-xs leading-5 text-ink/50">
                  Re-enter these private details because wallet addresses and payment amounts are
                  never exposed by the public contract.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-ink/55">
                    Worker NEAR testnet wallet
                    <input
                      className="field mt-2 font-mono text-xs"
                      value={editValue.walletAddress}
                      onChange={(event) =>
                        setEditValue({ ...editValue, walletAddress: event.target.value })
                      }
                      placeholder="worker.testnet"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                    />
                  </label>
                  <label className="text-xs font-semibold text-ink/55">
                    Scheduled payment (NEAR)
                    <input
                      className="field mt-2"
                      value={editValue.paymentAmountNear}
                      onChange={(event) =>
                        setEditValue({ ...editValue, paymentAmountNear: event.target.value })
                      }
                      inputMode="decimal"
                      placeholder="4"
                      required
                    />
                  </label>
                </div>
                {editValue.preferredChain !== "near" && (
                  <label className="mt-4 block text-xs font-semibold text-ink/55">
                    {editValue.preferredChain === "ethereum" ? "Ethereum" : "BNB Chain"}
                    {" destination address"}
                    <input
                      className="field mt-2 font-mono text-xs"
                      value={editValue.destinationAddress}
                      onChange={(event) =>
                        setEditValue({ ...editValue, destinationAddress: event.target.value })
                      }
                      placeholder="0x0000000000000000000000000000000000000000"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                    />
                  </label>
                )}
              </fieldset>
            )}
            {editError && (
              <p className="rounded-[10px] bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {editError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="button-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={busy || busyHash === editing.recipient_hash}
              >
                Save recipient
              </button>
            </div>
          </form>
        </Modal>
      )}

      {removing && (
        <Modal
          title={`Remove ${removing.name} from payroll roster?`}
          description="This cannot be undone. The recipient will need to be added again before future payments can be authorized."
          onClose={() => setRemoving(null)}
          size="sm"
          danger
        >
          {removeError && (
            <p className="mb-4 rounded-[10px] bg-red-100 px-4 py-3 text-sm text-red-800" role="alert">
              {removeError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="button-secondary" onClick={() => setRemoving(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              disabled={busy || busyHash === removing.recipient_hash}
              onClick={() => void confirmRemove()}
            >
              <Trash2 className="h-4 w-4" /> Remove recipient
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function privatePlanRefreshRequired(
  recipient: Recipient,
  update: RecipientUpdateDraft,
): boolean {
  let capChanged = true;
  try {
    capChanged = nearToYocto(update.personalCapNear) !== recipient.personal_cap;
  } catch {
    // Keep the private-plan fields visible while the edited cap is incomplete.
  }
  return (
    capChanged ||
    update.preferredChain !== recipient.preferred_chain ||
    update.preferredToken !== recipient.preferred_token
  );
}

function Status({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex w-fit rounded-[6px] px-2.5 py-1 text-xs font-semibold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {active ? "Active" : "Suspended"}
    </span>
  );
}

function RecipientActions({
  recipient,
  busy,
  onToggle,
  onEdit,
  onRemove,
  mobile = false,
}: {
  recipient: Recipient;
  busy: boolean;
  onToggle: (recipient: Recipient) => Promise<void>;
  onEdit: (recipient: Recipient) => void;
  onRemove: (recipient: Recipient) => void;
  mobile?: boolean;
}) {
  return (
    <div className={`flex gap-1 ${mobile ? "mt-4 justify-end border-t border-line pt-3" : "justify-end"}`}>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-[9px] text-ink/45 transition-colors hover:bg-canvas hover:text-ink disabled:opacity-30"
        disabled={busy}
        onClick={() => void onToggle(recipient).catch(() => undefined)}
        aria-label={recipient.active ? `Suspend ${recipient.name}` : `Reinstate ${recipient.name}`}
      >
        {recipient.active ? (
          <PauseCircle className="h-4 w-4" />
        ) : (
          <PlayCircle className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-[9px] text-ink/45 transition-colors hover:bg-canvas hover:text-ink disabled:opacity-30"
        disabled={busy}
        onClick={() => onEdit(recipient)}
        aria-label={`Edit ${recipient.name}`}
      >
        <Info className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-[9px] text-ink/45 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
        disabled={busy}
        onClick={() => onRemove(recipient)}
        aria-label={`Remove ${recipient.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyRoster() {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-semibold">No recipients configured yet</p>
      <p className="mt-2 text-xs leading-5 text-ink/45">
        Add a worker from the rules panel to begin building your payroll roster.
      </p>
    </div>
  );
}
