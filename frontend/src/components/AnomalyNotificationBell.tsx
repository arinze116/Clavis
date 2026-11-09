import { AlertTriangle, Bell, CheckCheck, RefreshCw, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useWallet } from "../contexts/WalletContext";
import { useOwnerContract } from "../hooks/useContractState";
import type { AnomalyEntry } from "../types";
import { loadLatestAnomalies } from "../utils/contract";
import { formatTimestamp } from "../utils/format";
import { NotificationSettingsModal } from "./NotificationSettingsModal";

const POLL_INTERVAL_MS = 10_000;

export function AnomalyNotificationBell() {
  const { accountId, wallet } = useWallet();
  const ownerContract = useOwnerContract(accountId);
  const contractId = ownerContract.contract?.contract_id ?? null;
  const [anomalies, setAnomalies] = useState<AnomalyEntry[]>([]);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [verifiedContractId, setVerifiedContractId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(contractId));
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeContractIdRef = useRef<string | null>(contractId);
  const refreshingContractIdRef = useRef<string | null>(null);
  activeContractIdRef.current = contractId;

  const refresh = useCallback(async () => {
    if (!contractId || refreshingContractIdRef.current === contractId) return;
    const requestedContractId = contractId;
    refreshingContractIdRef.current = requestedContractId;
    setLoading(true);
    setError(null);
    try {
      const next = await loadLatestAnomalies(requestedContractId);
      if (activeContractIdRef.current !== requestedContractId) return;
      setAnomalies(next);
      setVerifiedContractId(requestedContractId);
    } catch (reason) {
      if (activeContractIdRef.current !== requestedContractId) return;
      setError(reason instanceof Error ? reason.message : "The live contract read failed.");
    } finally {
      if (refreshingContractIdRef.current === requestedContractId) {
        refreshingContractIdRef.current = null;
      }
      if (activeContractIdRef.current === requestedContractId) setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    if (!contractId) {
      setAnomalies([]);
      setReadIds(new Set());
      setVerifiedContractId(null);
      setLoading(false);
      setError(null);
      return;
    }
    const activeContractId = contractId;
    setAnomalies([]);
    setReadIds(loadReadIds(activeContractId));
    setVerifiedContractId(null);
    setLoading(true);
    setError(null);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    window.addEventListener("online", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [contractId, refresh]);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const latest = useMemo(
    () => [...anomalies].sort((left, right) => right.anomaly_id - left.anomaly_id).slice(0, 5),
    [anomalies],
  );
  const unread = anomalies.filter(
    (anomaly) => !anomaly.reviewed && !readIds.has(anomaly.anomaly_id),
  );
  const hasVerifiedSnapshot = Boolean(contractId) && verifiedContractId === contractId;
  const verificationLoading = ownerContract.loading || loading;
  const verificationError = ownerContract.error ?? error;
  const bellLabel = hasVerifiedSnapshot
    ? `${unread.length} unread anomaly alerts`
    : verificationError
      ? "Anomaly alert verification unavailable"
      : "Anomaly alerts awaiting verified contract data";

  function retryVerification() {
    if (contractId) void refresh();
    else void ownerContract.refresh();
  }

  function markAllRead() {
    if (!contractId) return;
    const next = new Set(anomalies.map((anomaly) => anomaly.anomaly_id));
    setReadIds(next);
    storeReadIds(contractId, next);
  }

  if (!accountId) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative grid h-11 w-11 place-items-center rounded-[10px] border border-ink/10 bg-white text-ink/60 transition-colors hover:border-ink/25 hover:text-ink"
        onClick={() => setOpen((value) => !value)}
        aria-label={bellLabel}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-4 text-white">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[16px] border border-line bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4">
            <div>
              <p className="text-sm font-semibold">Anomaly alerts</p>
              <p className="mt-1 text-xs text-ink/45">
                {hasVerifiedSnapshot
                  ? `${unread.length} unread`
                  : verificationError
                    ? "Verification unavailable"
                    : "Waiting for verified contract data"}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs font-semibold text-moss disabled:opacity-40"
              onClick={markAllRead}
              disabled={unread.length === 0}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-[360px] divide-y divide-line overflow-y-auto">
            {error && hasVerifiedSnapshot && (
              <div className="flex items-start gap-3 bg-amber-50 px-4 py-3 text-amber-950">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">Unable to refresh anomaly state</p>
                  <p className="mt-1 text-xs leading-5 text-amber-900/70">
                    Showing the last verified contract snapshot.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-xs font-semibold"
                  onClick={() => void refresh()}
                  disabled={loading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Retry
                </button>
              </div>
            )}
            {latest.map((anomaly) => (
              <Link
                key={anomaly.anomaly_id}
                to="/dashboard#anomalies"
                onClick={() => {
                  if (contractId) {
                    const next = new Set(readIds).add(anomaly.anomaly_id);
                    setReadIds(next);
                    storeReadIds(contractId, next);
                  }
                  setOpen(false);
                }}
                className={`flex gap-3 px-4 py-4 transition-colors hover:bg-canvas ${
                  readIds.has(anomaly.anomaly_id) || anomaly.reviewed ? "opacity-65" : ""
                }`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {anomaly.anomaly_type.replaceAll("_", " ")}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-5 text-ink/50">
                    {anomaly.description}
                  </span>
                  <span className="mt-2 block font-mono text-[10px] text-ink/35">
                    {formatTimestamp(anomaly.timestamp)}
                  </span>
                </span>
              </Link>
            ))}
            {!hasVerifiedSnapshot && verificationLoading && (
              <div className="px-5 py-10 text-center">
                <RefreshCw className="mx-auto h-5 w-5 animate-spin text-moss" />
                <p className="mt-3 text-sm font-semibold">Checking anomaly state</p>
                <p className="mt-1 text-xs text-ink/45">Reading the latest final contract state.</p>
              </div>
            )}
            {!hasVerifiedSnapshot && verificationError && !verificationLoading && (
              <div className="px-5 py-10 text-center">
                <AlertTriangle className="mx-auto h-5 w-5 text-amber-700" />
                <p className="mt-3 text-sm font-semibold">Unable to verify anomaly state</p>
                <p className="mt-1 text-xs leading-5 text-ink/45">
                  No clean result is shown because the live contract read failed.
                </p>
                <button
                  type="button"
                  className="button-secondary mt-4"
                  onClick={retryVerification}
                  disabled={verificationLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${verificationLoading ? "animate-spin" : ""}`}
                  />{" "}
                  Retry
                </button>
              </div>
            )}
            {!hasVerifiedSnapshot && !contractId && !verificationLoading && !verificationError && (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-semibold">No payroll contract found</p>
                <p className="mt-1 text-xs leading-5 text-ink/45">
                  Connect an owner account with a deployed contract to monitor anomaly alerts.
                </p>
              </div>
            )}
            {hasVerifiedSnapshot && latest.length === 0 && !error && (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-semibold">No anomaly alerts</p>
                <p className="mt-1 text-xs text-ink/45">
                  The latest verified contract snapshot contains no alerts.
                </p>
              </div>
            )}
          </div>
          <div className="border-t border-line p-3">
            <button
              type="button"
              className="button-secondary w-full"
              onClick={() => {
                setOpen(false);
                setSettingsOpen(true);
              }}
            >
              <Settings2 className="h-4 w-4" /> Notification settings
            </button>
          </div>
        </div>
      )}
      {settingsOpen && wallet && (
        <NotificationSettingsModal
          accountId={accountId}
          wallet={wallet}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function storageKey(contractId: string): string {
  return `clavis.readAnomalies:${contractId}`;
}

function loadReadIds(contractId: string): Set<number> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(contractId)) ?? "[]") as unknown;
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is number => Number.isInteger(value) && value > 0)
        : [],
    );
  } catch {
    return new Set();
  }
}

function storeReadIds(contractId: string, ids: Set<number>): void {
  window.localStorage.setItem(storageKey(contractId), JSON.stringify([...ids].slice(-200)));
}
