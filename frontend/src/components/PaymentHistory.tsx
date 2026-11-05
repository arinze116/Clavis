import { Check, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { AuditEntry } from "../types";
import { formatTimestamp, outcomeDetails } from "../utils/format";

const nearBlocksUrl = "https://testnet.nearblocks.io";

function explorerLink(entry: AuditEntry, contractId: string): string {
  const transactionId = entry.transaction_id ?? entry.transaction_hash ?? entry.tx_hash;
  if (transactionId) return `${nearBlocksUrl}/txns/${transactionId}`;
  return entry.block_height
    ? `${nearBlocksUrl}/blocks/${entry.block_height}`
    : `${nearBlocksUrl}/address/${contractId}`;
}

type Filter = "all" | "approved" | "rejected";

export function PaymentHistory({
  entries,
  contractId,
  pageSize = 8,
  auditEmptyState = false,
}: {
  entries: AuditEntry[];
  contractId: string;
  pageSize?: number;
  auditEmptyState?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [newEntryIds, setNewEntryIds] = useState<Set<number>>(new Set());
  const previousIds = useRef<Set<number> | null>(null);
  const filtered = useMemo(
    () => entries.filter((entry) => {
      const approved = outcomeDetails(entry.outcome).approved;
      return filter === "all" || (filter === "approved" ? approved : !approved);
    }),
    [entries, filter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    const currentIds = new Set(entries.map((entry) => entry.payment_id));
    if (previousIds.current) {
      const added = new Set(
        entries
          .filter((entry) => !previousIds.current?.has(entry.payment_id))
          .map((entry) => entry.payment_id),
      );
      if (added.size > 0) {
        setNewEntryIds(added);
        const timer = window.setTimeout(() => setNewEntryIds(new Set()), 2_400);
        previousIds.current = currentIds;
        return () => window.clearTimeout(timer);
      }
    }
    previousIds.current = currentIds;
  }, [entries]);

  function selectFilter(value: Filter) {
    setFilter(value);
    setPage(0);
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <p className="eyebrow">Decision history</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Payment audit</h2>
        </div>
        <div className="flex rounded-full bg-canvas p-1">
          {(["all", "approved", "rejected"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => selectFilter(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${filter === value ? "bg-white shadow-sm" : "text-ink/45"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-line">
        {visible.map((entry) => {
          const outcome = outcomeDetails(entry.outcome);
          return (
            <div
              key={entry.payment_id}
              className={`grid gap-3 px-6 py-4 sm:grid-cols-[90px_1fr_130px_1fr] sm:items-center lg:px-8 ${
                newEntryIds.has(entry.payment_id) ? "audit-entry-new" : ""
              }`}
            >
              <span className="inline-flex items-center gap-2 font-mono text-xs text-ink/45">
                #{String(entry.payment_id).padStart(4, "0")}
                <a
                  href={explorerLink(entry, contractId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink/35 transition hover:text-moss"
                  aria-label={`Open payment ${entry.payment_id} on NEAR Explorer`}
                  title="Open on NEAR Explorer"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </span>
              <span className="text-sm text-ink/60">{formatTimestamp(entry.timestamp)}</span>
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${outcome.approved ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {outcome.approved ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {outcome.approved ? "Approved" : "Rejected"}
              </span>
              <span className="text-sm text-ink/45">{outcome.reason ?? "Policy checks passed"}</span>
            </div>
          );
        })}
        {visible.length === 0 && entries.length === 0 && auditEmptyState ? (
          <div className="px-6 py-14 text-center sm:px-8">
            <p className="text-base font-semibold">No payments yet — your agent will log every decision here</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/50">
              Start by adding recipients and funding your contract, then Clavis will record every approval and rejection automatically.
            </p>
            <Link to="/guide/business" className="button-secondary mt-5">
              Read the business guide
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-8 py-14 text-center text-sm text-ink/45">No matching decisions</p>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-line px-6 py-4 lg:px-8">
        <span className="text-xs text-ink/40">Page {page + 1} of {pageCount}</span>
        <div className="flex gap-1">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-line disabled:opacity-30"
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
            aria-label="Previous audit page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-line disabled:opacity-30"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((value) => value + 1)}
            aria-label="Next audit page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
