/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEAR_NETWORK?: string;
  readonly VITE_NEAR_RPC_URL?: string;
  readonly VITE_CONTRACT_ID?: string;
  readonly VITE_EXPLORER_URL?: string;
  readonly VITE_PRIVATE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
