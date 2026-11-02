import type { NetworkId, WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";

const configuredNetwork = import.meta.env.VITE_NEAR_NETWORK ?? "testnet";
export const networkId: NetworkId = configuredNetwork === "mainnet" ? "mainnet" : "testnet";
export const rpcUrl = import.meta.env.VITE_NEAR_RPC_URL ?? "https://rpc.testnet.near.org";
export const contractId = import.meta.env.VITE_CONTRACT_ID ?? "clavis.testnet";
export const explorerUrl =
  import.meta.env.VITE_EXPLORER_URL ?? "https://testnet.nearblocks.io";

let selectorPromise: Promise<WalletSelector> | null = null;
let modal: WalletSelectorModal | null = null;

export function getWalletSelector(): Promise<WalletSelector> {
  if (!selectorPromise) {
    selectorPromise = Promise.all([
      import("@near-wallet-selector/core"),
      import("@near-wallet-selector/modal-ui"),
      import("@near-wallet-selector/my-near-wallet"),
    ]).then(async ([core, modalUi, myNearWallet]) => {
      const selector = await core.setupWalletSelector({
        network: networkId,
        modules: [myNearWallet.setupMyNearWallet()],
      });
      modal = modalUi.setupModal(selector, {
        contractId,
        description: "Connect a NEAR testnet wallet to manage Clavis.",
      });
      return selector;
    });
  }
  return selectorPromise;
}

export async function showWalletModal(): Promise<void> {
  await getWalletSelector();
  modal?.show();
}
