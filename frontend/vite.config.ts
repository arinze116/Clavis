import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const rpcProxyPath = "/api/near-rpc";
const aiProxyPath = "/api/ai";
const notificationProxyPath = "/api/notifications";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rpcTarget = env.VITE_NEAR_RPC_URL?.trim() || "https://test.rpc.fastnear.com";
  const aiTarget = env.VITE_AI_PROXY_TARGET?.trim();
  const notificationTarget = env.VITE_NOTIFICATION_PROXY_TARGET?.trim();
  const proxy = {
    [rpcProxyPath]: {
      target: rpcTarget,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/near-rpc/, "") || "/",
    },
    ...(aiTarget
      ? {
          [aiProxyPath]: {
            target: aiTarget,
            changeOrigin: true,
            headers: { origin: new URL(aiTarget).origin },
          },
        }
      : {}),
    ...(notificationTarget
      ? {
          [notificationProxyPath]: {
            target: notificationTarget,
            changeOrigin: true,
            headers: { origin: new URL(notificationTarget).origin },
          },
        }
      : {}),
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
