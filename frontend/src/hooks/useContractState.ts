import { useCallback, useEffect, useRef, useState } from "react";

import type { ContractRecord, ContractSnapshot } from "../types";
import {
  getContractByOwner,
  loadContractSnapshot,
  storeContractId,
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
    if (!loading) {
      setShowLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLoading(true), 500);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const resolvingContract = Boolean(contractId) && resolvedContractId !== contractId;
  return {
    data: resolvingContract ? null : data,
    loading: loading || resolvingContract,
    showLoading,
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
  return {
    contract: resolvingOwner ? null : contract,
    loading: loading || resolvingOwner,
    error: resolvingOwner ? null : error,
    refresh,
  };
}
