import { MoreHorizontal, PauseCircle, PlayCircle, Trash2 } from "lucide-react";

import type { Recipient } from "../types";
import { chainLabel, formatNear, formatTimestamp } from "../utils/format";

interface RecipientTableProps {
  recipients: Recipient[];
  busyHash: string | null;
  onToggle: (recipient: Recipient) => void;
  onRemove: (recipient: Recipient) => void;
}

export function RecipientTable({ recipients, busyHash, onToggle, onRemove }: RecipientTableProps) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-6 py-5 lg:px-8">
        <div>
          <p className="eyebrow">Approved recipients</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Your payroll roster</h2>
        </div>
        <span className="rounded-full bg-canvas px-3 py-1.5 font-mono text-xs">{recipients.length}/20</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-canvas/70 text-[11px] uppercase tracking-[0.14em] text-ink/40">
            <tr>
              <th className="px-6 py-4 font-semibold lg:px-8">Recipient</th>
              <th className="px-4 py-4 font-semibold">Route</th>
              <th className="px-4 py-4 font-semibold">Personal cap</th>
              <th className="px-4 py-4 font-semibold">Next payment</th>
              <th className="px-4 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold lg:px-8"><MoreHorizontal className="ml-auto h-4 w-4" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {recipients.map((recipient) => (
              <tr key={recipient.recipient_hash} className="transition hover:bg-canvas/45">
                <td className="px-6 py-4 lg:px-8">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-xs font-semibold text-acid">
                      {recipient.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium">{recipient.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink/35">{recipient.schedule}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm">
                  {chainLabel(recipient.preferred_chain)} · {recipient.preferred_token}
                </td>
                <td className="px-4 py-4 text-sm font-medium">{formatNear(recipient.personal_cap)}</td>
                <td className="px-4 py-4 text-sm text-ink/55">
                  {recipient.next_payment_at ? formatTimestamp(recipient.next_payment_at) : "Manual milestone"}
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${recipient.active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {recipient.active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-6 py-4 lg:px-8">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center rounded-full text-ink/45 transition hover:bg-canvas hover:text-ink disabled:opacity-30"
                      disabled={busyHash === recipient.recipient_hash}
                      onClick={() => onToggle(recipient)}
                      aria-label={recipient.active ? `Suspend ${recipient.name}` : `Reinstate ${recipient.name}`}
                    >
                      {recipient.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center rounded-full text-ink/45 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      disabled={busyHash === recipient.recipient_hash}
                      onClick={() => onRemove(recipient)}
                      aria-label={`Remove ${recipient.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {recipients.length === 0 && (
              <tr><td colSpan={6} className="px-8 py-16 text-center text-sm text-ink/45">No recipients configured yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
