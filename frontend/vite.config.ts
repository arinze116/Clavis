import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const rpcProxyPath = "/near-rpc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rpcTarget = env.VITE_NEAR_RPC_URL?.trim() || "https://rpc.testnet.near.org";
  const proxy = {
    [rpcProxyPath]: {
      target: rpcTarget,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/near-rpc/, "") || "/",
    },
  };

  return {
    plugins: [
      react(),
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        protocolImports: true,
      }),
    ],
    server: {
      port: 5173,
      strictPort: true,
      proxy,
    },
    preview: {
      port: 4173,
      strictPort: true,
      proxy,
    },
  };
});
