import { useCallback, useEffect, useRef, useState } from "react";

import type { ContractRecord, ContractSnapshot } from "../types";
import {
  enrichAuditSnapshot,
  enrichContractSnapshotAudit,
  getContractByOwner,
  loadAuditSnapshot,
  loadContractSnapshot,
  storeContractId,
  type AuditSnapshot,
} from "../utils/contract";

export function useContractState(contractId: string | null, pollIntervalMs = 0) {
  const [data, setData] = useState<ContractSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(contractId));
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedContractId, setResolvedContractId] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!contractId) {
      setData(null);
      setLoading(false);
      setResolvedContractId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snapshot = await loadContractSnapshot(contractId);
      if (requestId.current !== currentRequest) return;
      setData(snapshot);
      setResolvedContractId(contractId);
      // Explorer links are useful evidence, but they must never delay the
      // contract-backed dashboard. Enrich them after the first meaningful paint.
      void enrichContractSnapshotAudit(snapshot).then((enriched) => {
        if (requestId.current !== currentRequest) return;
        setData(enriched);
      });
    } catch (reason) {
      if (requestId.current !== currentRequest) return;
      setError(reason instanceof Error ? reason.message : "Unable to load contract state");
      setResolvedContractId(contractId);
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!contractId || pollIntervalMs <= 0) return;
    const timer = window.setInterval(() => void refresh(), pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [contractId, pollIntervalMs, refresh]);

  useEffect(() => {
    if (!contractId) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [contractId, refresh]);

  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLoading(true), 500);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const resolvingContract = Boolean(contractId) && resolvedContractId !== contractId;
  const matchingData = data?.contractId === contractId ? data : null;
  return {
    data: resolvingContract ? null : matchingData,
    loading: loading || resolvingContract,
    showLoading,
    error: resolvingContract ? null : error,
    refresh,
  };
}

/**
 * Public audit pages need only two contract methods. Keeping this separate from
 * the owner snapshot avoids loading treasury, roster, and anomaly state merely
 * to render the ledger.
 */
export function useAuditState(contractId: string, pollIntervalMs = 0) {
  const [data, setData] = useState<AuditSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedContractId, setResolvedContractId] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const snapshot = await loadAuditSnapshot(contractId);
      if (requestId.current !== currentRequest) return;
      setData(snapshot);
      setResolvedContractId(contractId);
      void enrichAuditSnapshot(snapshot).then((enriched) => {
        if (requestId.current === currentRequest) setData(enriched);
      });
    } catch (reason) {
      if (requestId.current !== currentRequest) return;
      setError(reason instanceof Error ? reason.message : "Unable to load the audit ledger");
      setResolvedContractId(contractId);
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    const timer = window.setInterval(() => void refresh(), pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [pollIntervalMs, refresh]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  const resolvingContract = resolvedContractId !== contractId;
  const matchingData = data?.contractId === contractId ? data : null;
  return {
    data: resolvingContract ? null : matchingData,
    loading: loading || resolvingContract,
    error: resolvingContract ? null : error,
    refresh,
  };
}

export function useOwnerContract(accountId: string | null, fallbackToRootContract = true) {
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(accountId));
  const [error, setError] = useState<string | null>(null);
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!accountId) {
      setContract(null);
      setLoading(false);
      setError(null);
      setResolvedAccountId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const value = await getContractByOwner(accountId, fallbackToRootContract);
      if (requestId.current !== currentRequest) return;
      setContract(value);
      setResolvedAccountId(accountId);
      if (value) storeContractId(value.contract_id);
    } catch (reason) {
      if (requestId.current !== currentRequest) return;
      setError(reason instanceof Error ? reason.message : "Unable to find your business contract");
      setResolvedAccountId(accountId);
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [accountId, fallbackToRootContract]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resolvingOwner = Boolean(accountId) && resolvedAccountId !== accountId;
  const matchingContract = contract?.owner === accountId ? contract : null;
  return {
    contract: resolvingOwner ? null : matchingContract,
    loading: loading || resolvingOwner,
    error: resolvingOwner ? null : error,
    refresh,
  };
}
