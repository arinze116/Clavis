/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEAR_NETWORK?: string;
  readonly VITE_NEAR_RPC_URL?: string;
  readonly VITE_FACTORY_CONTRACT_ID?: string;
  readonly VITE_ROOT_CONTRACT_ID?: string;
  readonly VITE_EXPLORER_URL?: string;
  readonly VITE_NEARBLOCKS_API_URL?: string;
  readonly VITE_PRIVATE_API_URL?: string;
  readonly VITE_NOTIFICATION_API_URL?: string;
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
