import type { NetworkId, WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";

function envValue(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

const configuredNetwork = envValue(import.meta.env.VITE_NEAR_NETWORK, "testnet");
export const networkId: NetworkId = configuredNetwork === "mainnet" ? "mainnet" : "testnet";
export const rpcUrl = envValue(
  import.meta.env.VITE_NEAR_RPC_URL,
  "https://rpc.testnet.fastnear.com",
);
export const rpcEndpoint = import.meta.env.DEV ? "/near-rpc" : rpcUrl;
export const rootContractId = envValue(
  import.meta.env.VITE_ROOT_CONTRACT_ID,
  "clavis.testnet",
);
export const factoryContractId = envValue(
  import.meta.env.VITE_FACTORY_CONTRACT_ID,
  "factory.clavis.testnet",
);
export const explorerUrl = envValue(
  import.meta.env.VITE_EXPLORER_URL,
  "https://testnet.nearblocks.io",
);
export const nearBlocksApiUrl = envValue(
  import.meta.env.VITE_NEARBLOCKS_API_URL,
  "https://api-testnet.nearblocks.io",
);

let selectorPromise: Promise<WalletSelector> | null = null;
let modal: WalletSelectorModal | null = null;

export function getWalletSelector(): Promise<WalletSelector> {
  if (!selectorPromise) {
    selectorPromise = Promise.all([
      import("@near-wallet-selector/core"),
      import("@near-wallet-selector/modal-ui"),
      import("@near-wallet-selector/meteor-wallet"),
      import("@near-wallet-selector/my-near-wallet"),
      import("@near-wallet-selector/sender"),
    ])
      .then(async ([core, modalUi, meteorWallet, myNearWallet, sender]) => {
        const selector = await core.setupWalletSelector({
          network: networkId,
          modules: [
            meteorWallet.setupMeteorWallet(),
            myNearWallet.setupMyNearWallet(),
            sender.setupSender(),
          ],
        });
        modal = modalUi.setupModal(selector, {
          contractId: factoryContractId,
          description: "Connect a NEAR testnet wallet to manage Clavis.",
        });
        return selector;
      })
      .catch((error: unknown) => {
        // Allow a transient wallet initialization failure to be retried.
        selectorPromise = null;
        throw error;
      });
  }
  return selectorPromise;
}

export async function showWalletModal(): Promise<void> {
  await getWalletSelector();
  modal?.show();
}
