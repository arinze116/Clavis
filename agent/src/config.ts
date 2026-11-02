import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const agentRoot = path.resolve(currentDirectory, "..");

const booleanFromEnvironment = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional(),
);
const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const schema = z.object({
  NEAR_ACCOUNT_ID: z.string().min(2),
  NEAR_PRIVATE_KEY: z.string().regex(/^(ed25519|secp256k1):/),
  CONTRACT_ID: z.string().min(2),
  NEAR_NETWORK: z.string().default("testnet"),
  NEAR_RPC_URL: z.string().url().default("https://rpc.testnet.near.org"),
  INTENTS_CONTRACT_ID: z.string().default("intents.near"),
  CONFIDENTIAL_EXECUTOR_URL: optionalUrl,
  INTENTS_API_KEY: optionalSecret,
  REPORT_OWNER_ID: z.string().min(2),
  PAYROLL_CONFIG_PATH: z.string().default("./config/payroll.local.json"),
  AGENT_STATE_PATH: z.string().default("./data/state.json"),
  REPORT_DIRECTORY: z.string().default("./reports"),
  POLL_INTERVAL_MS: z.coerce.number().int().min(5_000).default(60_000),
  RETRY_DELAY_MS: z.coerce.number().int().min(1_000).default(5_000),
  DRY_RUN_INTENTS: booleanFromEnvironment.default(true),
  RUN_ONCE: booleanFromEnvironment.default(false),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid agent configuration: ${details}`);
}

function resolveAgentPath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(agentRoot, value);
}

export const config = {
  nearAccountId: parsed.data.NEAR_ACCOUNT_ID,
  nearPrivateKey: parsed.data.NEAR_PRIVATE_KEY,
  contractId: parsed.data.CONTRACT_ID,
  nearNetwork: parsed.data.NEAR_NETWORK,
  nearRpcUrl: parsed.data.NEAR_RPC_URL,
  intentsContractId: parsed.data.INTENTS_CONTRACT_ID,
  confidentialExecutorUrl: parsed.data.CONFIDENTIAL_EXECUTOR_URL,
  intentsApiKey: parsed.data.INTENTS_API_KEY,
  reportOwnerId: parsed.data.REPORT_OWNER_ID,
  payrollConfigPath: resolveAgentPath(parsed.data.PAYROLL_CONFIG_PATH),
  statePath: resolveAgentPath(parsed.data.AGENT_STATE_PATH),
  reportDirectory: resolveAgentPath(parsed.data.REPORT_DIRECTORY),
  pollIntervalMs: parsed.data.POLL_INTERVAL_MS,
  retryDelayMs: parsed.data.RETRY_DELAY_MS,
  dryRunIntents: parsed.data.DRY_RUN_INTENTS,
  runOnce: parsed.data.RUN_ONCE,
} as const;
