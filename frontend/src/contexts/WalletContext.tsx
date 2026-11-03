import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Wallet, WalletSelector } from "@near-wallet-selector/core";

import { getWalletSelector, showWalletModal } from "../utils/near";
import { notifyWalletCallbackTransactions } from "../utils/notifications";

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
      if (activeAccount) notifyWalletCallbackTransactions(activeAccount.accountId);
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
    let active = true;

    // Warm the selector and wallet modules before the connect button becomes interactive.
    void initialize().catch(() => {
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [initialize]);

  const connect = useCallback(async () => {
    await initialize();
    await showWalletModal();
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
