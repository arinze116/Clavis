import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Wallet, WalletSelector } from "@near-wallet-selector/core";

import { getWalletSelector, showWalletModal } from "../utils/near";

interface WalletContextValue {
  selector: WalletSelector | null;
  wallet: Wallet | null;
  accountId: string | null;
  loading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  const initialize = useCallback(async (): Promise<WalletSelector> => {
    const nextSelector = await getWalletSelector();
    setSelector(nextSelector);

    const updateAccounts = async (accounts: { accountId: string; active?: boolean }[]) => {
      const activeAccount = accounts.find((account) => account.active) ?? accounts[0];
      setAccountId(activeAccount?.accountId ?? null);
      setWallet(activeAccount ? await nextSelector.wallet() : null);
      setLoading(false);
    };

    await updateAccounts(nextSelector.store.getState().accounts);
    if (!subscriptionRef.current) {
      subscriptionRef.current = nextSelector.store.observable.subscribe((state) => {
        void updateAccounts(state.accounts);
      });
    }
    return nextSelector;
  }, []);

  useEffect(() => {
    const pathNeedsWallet = !["/", "/audit"].includes(window.location.pathname);
    const hasPreviousWallet = window.localStorage.getItem("selectedWalletId") !== null;
    if (pathNeedsWallet || hasPreviousWallet) {
      void initialize();
    } else {
      setLoading(false);
    }

    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [initialize]);

  const connect = useCallback(async () => {
    setLoading(true);
    await initialize();
    await showWalletModal();
    setLoading(false);
  }, [initialize]);

  const disconnect = useCallback(async () => {
    if (wallet) {
      await wallet.signOut();
    }
  }, [wallet]);

  const value = useMemo(
    () => ({ selector, wallet, accountId, loading, connect, disconnect }),
    [selector, wallet, accountId, loading, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider");
  }
  return context;
}
