#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const allowedRpcUrls = new Set([
  "https://test.rpc.fastnear.com",
  "https://near-testnet.drpc.org",
  "https://testnet-rpc.intea.rs",
  "https://archival-rpc.testnet.near.org",
]);
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
const outputDirectory = path.resolve(
  process.argv[2] ?? `/home/ubuntu/.local/state/clavis-v02-${formatDate(new Date())}`,
);
const accounts = [
  "clavis.testnet",
  "factory.clavis.testnet",
  "clavis-agent.testnet",
  "arinze-worker1.testnet",
  "arinze-worker2.testnet",
];

if (!allowedRpcUrls.has(rpcUrl)) {
  throw new Error(`Refusing unrecognised Testnet RPC endpoint: ${rpcUrl}`);
}
if (!accounts.every((accountId) => accountId.endsWith(".testnet"))) {
  throw new Error("Every deployment identity must be a .testnet account");
}

await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
await chmod(outputDirectory, 0o700);

const status = await rpc("status", []);
if (status.chain_id !== "testnet") {
  throw new Error(`Refusing unexpected NEAR chain: ${status.chain_id}`);
}

const accountState = Object.fromEntries(
  await Promise.all(
    accounts.map(async (accountId) => {
      const [account, accessKeys] = await Promise.all([
        query({ request_type: "view_account", finality: "final", account_id: accountId }),
        query({
          request_type: "view_access_key_list",
          finality: "final",
          account_id: accountId,
        }),
      ]);
      return [
        accountId,
        {
          ...account,
          access_keys: accessKeys.keys,
        },
      ];
    }),
  ),
);

const root = await views("clavis.testnet", [
  ["owner", "get_owner"],
  ["agent", "get_agent"],
  ["version", "contract_version"],
  ["daily_limit", "get_daily_limit"],
  ["per_payment_limit", "get_per_payment_limit"],
  ["daily_spent", "get_daily_spent"],
  ["last_reset_timestamp", "get_last_reset_timestamp"],
  ["paused", "is_paused"],
  ["recipient_count", "get_recipient_count"],
  ["recipients", "get_recipients", { from: 0, limit: 100 }],
  ["log_count", "get_log_count"],
  ["audit", "get_audit_log_reverse", { from: 0, limit: 100 }],
  ["anomaly_count", "get_anomaly_count"],
  ["anomalies", "get_anomalies", { from: 0, limit: 100, active_only: false }],
]);
const factory = await views("factory.clavis.testnet", [
  ["root_account", "get_root_account"],
  ["version", "contract_version"],
  ["contracts", "get_all_contracts"],
]);

for (const accountId of ["clavis.testnet", "factory.clavis.testnet"]) {
  const code = await query({
    request_type: "view_code",
    finality: "final",
    account_id: accountId,
  });
  const fileName = `${accountId}.before.wasm`;
  const bytes = Buffer.from(code.code_base64, "base64");
  await writePrivate(path.join(outputDirectory, fileName), bytes);
  accountState[accountId].downloaded_code_sha256 = sha256(bytes);
}

const protectedFiles = [
  "/opt/clavis/agent/.env",
  "/opt/clavis/agent/config/agent-credentials.local.json",
  "/opt/clavis/agent/config/payroll.local.json",
];
const protectedFileEvidence = {};
for (const filePath of protectedFiles) {
  const metadata = await stat(filePath);
  const bytes = await readFile(filePath);
  protectedFileEvidence[filePath] = {
    mode: (metadata.mode & 0o777).toString(8).padStart(3, "0"),
    size: metadata.size,
    sha256: sha256(bytes),
  };
}

const privateBackupDirectory = path.join(outputDirectory, "agent-state-before");
await mkdir(privateBackupDirectory, { recursive: true, mode: 0o700 });
await copyPrivate(
  "/opt/clavis/agent/config/payroll.local.json",
  path.join(privateBackupDirectory, "payroll.local.json"),
);
for (const fileName of await readdir("/opt/clavis/agent/data")) {
  const source = path.join("/opt/clavis/agent/data", fileName);
  const metadata = await stat(source);
  if (metadata.isFile() && fileName.endsWith(".json")) {
    await copyPrivate(source, path.join(privateBackupDirectory, fileName));
  }
}
const contractsStateDirectory = "/opt/clavis/agent/data/contracts";
for (const fileName of await readdir(contractsStateDirectory)) {
  const source = path.join(contractsStateDirectory, fileName);
  const metadata = await stat(source);
  if (metadata.isFile() && fileName.endsWith(".json")) {
    await copyPrivate(source, path.join(privateBackupDirectory, `contracts-${fileName}`));
  }
}

const baseline = {
  captured_at: new Date().toISOString(),
  rpc_url: rpcUrl,
  chain_id: status.chain_id,
  protocol_version: status.protocol_version,
  workspace_head: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: "/home/ubuntu/Clavis1",
    encoding: "utf8",
  }).trim(),
  deployed_source_head: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: "/opt/clavis",
    encoding: "utf8",
  }).trim(),
  accounts: accountState,
  root,
  factory,
  protected_file_evidence: protectedFileEvidence,
};
await writePrivate(
  path.join(outputDirectory, "baseline.json"),
  `${JSON.stringify(baseline, null, 2)}\n`,
);

console.log(`Captured Testnet rollback baseline: ${outputDirectory}`);
console.log(`Root code hash: ${accountState["clavis.testnet"].code_hash}`);
console.log(`Factory code hash: ${accountState["factory.clavis.testnet"].code_hash}`);

async function views(accountId, definitions) {
  return Object.fromEntries(
    await Promise.all(
      definitions.map(async ([label, methodName, args = {}]) => {
        try {
          return [label, await view(accountId, methodName, args)];
        } catch (error) {
          return [label, { unavailable: error instanceof Error ? error.message : String(error) }];
        }
      }),
    ),
  );
}

async function view(accountId, methodName, args = {}) {
  const result = await query({
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(result.result).toString("utf8"));
}

function query(parameters) {
  return rpc("query", parameters);
}

async function rpc(method, parameters) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-v02-baseline", method, params: parameters }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`NEAR RPC returned HTTP ${response.status}`);
  }
  const body = await response.json();
  if (body.error || body.result === undefined) {
    throw new Error(body.error?.data ?? body.error?.message ?? "Invalid NEAR RPC response");
  }
  return body.result;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writePrivate(filePath, value) {
  await writeFile(filePath, value, { mode: 0o600 });
  await chmod(filePath, 0o600);
}

async function copyPrivate(source, destination) {
  await copyFile(source, destination);
  await chmod(destination, 0o600);
}

function formatDate(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value) => String(value).padStart(2, "0"))
    .join("");
}
