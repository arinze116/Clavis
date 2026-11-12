import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

function loadConfig(rpcUrl: string) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "--eval", 'import("./src/config.ts")'],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_CREDENTIALS_PATH: "./config/agent-credentials.local.json",
        NEAR_NETWORK: "testnet",
        NEAR_RPC_URL: rpcUrl,
      },
    },
  );
}

describe("agent Testnet configuration", () => {
  it("accepts a Testnet RPC hostname label", () => {
    const result = loadConfig("https://test.rpc.fastnear.com");

    expect(result.status).toBe(0);
  });

  it("rejects a hostname that only contains the word testnet", () => {
    const result = loadConfig("https://not-testnet.example");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("NEAR_RPC_URL must identify a Testnet endpoint");
  });
});
