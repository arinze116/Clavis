import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { assertNoFullAccessOverride } from "./agent-credentials.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const agentRoot = path.resolve(currentDirectory, "..");

const booleanFromEnvironment = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalStrongSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(32).optional(),
);

const schema = z.object({
  NEAR_ACCOUNT_ID: z.string().min(2).optional(),
  NEAR_PRIVATE_KEY: z.string().regex(/^(ed25519|secp256k1):/).optional(),
  LEGACY_AGENT_CONTRACT_ID: z.string().min(2).optional(),
  AGENT_CREDENTIALS_PATH: z.string().trim().min(1).optional(),
  NEAR_NETWORK: z.string().default("testnet"),
  NEAR_RPC_URL: z.string().url().default("https://rpc.testnet.fastnear.com"),
  FACTORY_CONTRACT_ID: z.string().default("factory.clavis.testnet"),
  INTENTS_CONTRACT_ID: z.string().default("intents.near"),
  SOLVER_RELAY_URL: z.string().url().default("https://solver-relay-v2.chaindefuser.com/rpc"),
  INTENTS_API_KEY: optionalSecret,
  SETTLEMENT_ACCOUNT_ID: z.string().min(2).optional(),
  SETTLEMENT_PRIVATE_KEY: z.string().regex(/^(ed25519|secp256k1):/).optional(),
  PAYROLL_CONFIG_PATH: z.string().default("./config/payroll.local.json"),
  PAYROLL_DIRECTORY: z.string().default("./config/payrolls"),
  AGENT_DATA_DIRECTORY: z.string().default("./data/contracts"),
  INTENT_STATE_PATH: z.string().default("./data/intents.json"),
  REPORT_DIRECTORY: z.string().default("./reports"),
  POLL_INTERVAL_MS: z.coerce.number().int().min(5_000).default(60_000),
  NOTIFICATION_EVENT_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(30_000)
    .default(10_000),
  RETRY_DELAY_MS: z.coerce.number().int().min(1_000).default(5_000),
  INTENT_RETRY_DELAY_MS: z.coerce.number().int().min(30_000).default(30_000),
  RUN_ONCE: booleanFromEnvironment.default(false),
  RESEND_API_KEY: optionalSecret,
  RESEND_FROM_EMAIL: z.string().default("Clavis Testnet <onboarding@resend.dev>"),
  TELEGRAM_BOT_TOKEN: optionalSecret,
  TELEGRAM_BOT_USERNAME: optionalSecret,
  TELEGRAM_CHAT_ID: optionalSecret,
  NOTIFICATION_API_ENABLED: booleanFromEnvironment.default(false),
  NOTIFICATION_API_KEY: optionalStrongSecret,
  NOTIFICATION_API_HOST: z.string().default("127.0.0.1"),
  NOTIFICATION_API_PORT: z.coerce.number().int().min(1).max(65_535).default(8_787),
  NOTIFICATION_PREFERENCES_PATH: z
    .string()
    .default("./data/notification-preferences.json"),
  NOTIFICATION_SESSION_TTL_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(30 * 24 * 60 * 60 * 1_000),
  NOTIFICATION_ALLOWED_ORIGINS: z
    .string()
    .default("https://clavisapp.vercel.app,http://localhost:5173"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid agent configuration: ${details}`);
}

assertNoFullAccessOverride(process.env.ALLOW_FULL_ACCESS_AGENT);

const legacyCredentialFields = [
  parsed.data.NEAR_ACCOUNT_ID,
  parsed.data.NEAR_PRIVATE_KEY,
  parsed.data.LEGACY_AGENT_CONTRACT_ID,
].filter(Boolean).length;
if (legacyCredentialFields !== 0 && legacyCredentialFields !== 3) {
  throw new Error(
    "NEAR_ACCOUNT_ID, NEAR_PRIVATE_KEY, and LEGACY_AGENT_CONTRACT_ID must be set together",
  );
}

if (
  !parsed.data.AGENT_CREDENTIALS_PATH &&
  legacyCredentialFields !== 3
) {
  throw new Error(
    "AGENT_CREDENTIALS_PATH or the single-contract legacy credential fields are required",
  );
}

if (Boolean(parsed.data.SETTLEMENT_ACCOUNT_ID) !== Boolean(parsed.data.SETTLEMENT_PRIVATE_KEY)) {
  throw new Error(
    "SETTLEMENT_ACCOUNT_ID and SETTLEMENT_PRIVATE_KEY must either both be set or both be omitted",
  );
}

if (parsed.data.NOTIFICATION_API_ENABLED && !parsed.data.NOTIFICATION_API_KEY) {
  throw new Error("NOTIFICATION_API_KEY is required when NOTIFICATION_API_ENABLED=true");
}

const notificationAllowedOrigins = new Set(
  parsed.data.NOTIFICATION_ALLOWED_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
if (parsed.data.NOTIFICATION_API_ENABLED && notificationAllowedOrigins.size === 0) {
  throw new Error(
    "NOTIFICATION_ALLOWED_ORIGINS must include at least one trusted frontend origin",
  );
}

function resolveAgentPath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(agentRoot, value);
}

export const config = {
  nearAccountId: parsed.data.NEAR_ACCOUNT_ID,
  nearPrivateKey: parsed.data.NEAR_PRIVATE_KEY,
  legacyAgentContractId: parsed.data.LEGACY_AGENT_CONTRACT_ID,
  agentCredentialsPath: parsed.data.AGENT_CREDENTIALS_PATH
    ? resolveAgentPath(parsed.data.AGENT_CREDENTIALS_PATH)
    : undefined,
  nearNetwork: parsed.data.NEAR_NETWORK,
  nearRpcUrl: parsed.data.NEAR_RPC_URL,
  factoryContractId: parsed.data.FACTORY_CONTRACT_ID,
  intentsContractId: parsed.data.INTENTS_CONTRACT_ID,
  solverRelayUrl: parsed.data.SOLVER_RELAY_URL,
  intentsApiKey: parsed.data.INTENTS_API_KEY,
  settlementAccountId: parsed.data.SETTLEMENT_ACCOUNT_ID,
  settlementPrivateKey: parsed.data.SETTLEMENT_PRIVATE_KEY,
  payrollConfigPath: resolveAgentPath(parsed.data.PAYROLL_CONFIG_PATH),
  payrollDirectory: resolveAgentPath(parsed.data.PAYROLL_DIRECTORY),
  dataDirectory: resolveAgentPath(parsed.data.AGENT_DATA_DIRECTORY),
  intentStatePath: resolveAgentPath(parsed.data.INTENT_STATE_PATH),
  reportDirectory: resolveAgentPath(parsed.data.REPORT_DIRECTORY),
  pollIntervalMs: parsed.data.POLL_INTERVAL_MS,
  notificationEventPollIntervalMs: parsed.data.NOTIFICATION_EVENT_POLL_INTERVAL_MS,
  retryDelayMs: parsed.data.RETRY_DELAY_MS,
  intentRetryDelayMs: parsed.data.INTENT_RETRY_DELAY_MS,
  runOnce: parsed.data.RUN_ONCE,
  resendApiKey: parsed.data.RESEND_API_KEY,
  resendFromEmail: parsed.data.RESEND_FROM_EMAIL,
  telegramBotToken: parsed.data.TELEGRAM_BOT_TOKEN,
  telegramBotUsername: parsed.data.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, ""),
  telegramChatId: parsed.data.TELEGRAM_CHAT_ID,
  notificationApiEnabled: parsed.data.NOTIFICATION_API_ENABLED,
  notificationApiKey: parsed.data.NOTIFICATION_API_KEY,
  notificationApiHost: parsed.data.NOTIFICATION_API_HOST,
  notificationApiPort: parsed.data.NOTIFICATION_API_PORT,
  notificationPreferencesPath: resolveAgentPath(parsed.data.NOTIFICATION_PREFERENCES_PATH),
  notificationSessionTtlMs: parsed.data.NOTIFICATION_SESSION_TTL_MS,
  notificationAllowedOrigins,
} as const;
