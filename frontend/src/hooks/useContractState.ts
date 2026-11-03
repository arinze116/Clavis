import { useCallback, useEffect, useState } from "react";

import type { ContractRecord, ContractSnapshot } from "../types";
import {
  getContractByOwner,
  loadContractSnapshot,
  storeContractId,
} from "../utils/contract";

export function useContractState(contractId: string | null) {
  const [data, setData] = useState<ContractSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(contractId));
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!contractId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await loadContractSnapshot(contractId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load contract state");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLoading(true), 500);
    return () => window.clearTimeout(timer);
  }, [loading]);

  return { data, loading, showLoading, error, refresh };
}

export function useOwnerContract(accountId: string | null) {
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(accountId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accountId) {
      setContract(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const value = await getContractByOwner(accountId);
      setContract(value);
      if (value) storeContractId(value.contract_id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to find your business contract");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { contract, loading, error, refresh };
}
