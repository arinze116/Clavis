import { useCallback, useEffect, useState } from "react";

import type { ContractSnapshot } from "../types";
import { loadContractSnapshot } from "../utils/contract";

export function useContractState() {
  const [data, setData] = useState<ContractSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadContractSnapshot());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load contract state");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
