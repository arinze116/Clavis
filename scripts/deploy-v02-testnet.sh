#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly NEAR_BINARY="/home/ubuntu/.local/lib/clavis-near/near-v0.31.1/near"
readonly ROOT_ACCOUNT="clavis.testnet"
readonly FACTORY_ACCOUNT="factory.clavis.testnet"
readonly ROOT_PUBLIC_KEY="ed25519:Bzk9o3X52NXSWU8GW2HXFiRWj8TdLYzVKSZQxi7vDq8c"
readonly FACTORY_PUBLIC_KEY="ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD"
readonly RPC_URL="${NEAR_RPC_URL:-https://rpc.testnet.fastnear.com}"
readonly BASELINE_DIRECTORY="${CLAVIS_BASELINE_DIRECTORY:-/home/ubuntu/.local/state/clavis-v02-20261109}"
readonly BASELINE_PATH="$BASELINE_DIRECTORY/baseline.json"
readonly EVIDENCE_DIRECTORY="$BASELINE_DIRECTORY/execution"
readonly PHASE="${1:-all}"

case "$PHASE" in
  all | root | factory) ;;
  *)
    echo "Usage: bash scripts/deploy-v02-testnet.sh [all|root|factory]" >&2
    exit 2
    ;;
esac

[[ "${CLAVIS_NEAR_KEYRING_ACTIVE:-}" == "1" ]] || {
  echo "Run this script through scripts/run-with-clavis-near-keyring.sh." >&2
  exit 2
}
[[ -x "$NEAR_BINARY" ]] || { echo "Pinned NEAR CLI is unavailable." >&2; exit 2; }
[[ -f "$BASELINE_PATH" ]] || { echo "Rollback baseline is missing: $BASELINE_PATH" >&2; exit 2; }
[[ "$ROOT_ACCOUNT" == *.testnet && "$FACTORY_ACCOUNT" == *.testnet ]] || {
  echo "Deployment accounts must be on Testnet." >&2
  exit 2
}

case "${RPC_URL%/}" in
  https://rpc.testnet.near.org | https://rpc.testnet.fastnear.com | https://archival-rpc.testnet.fastnear.com) ;;
  *)
    echo "Refusing unrecognised Testnet RPC endpoint: $RPC_URL" >&2
    exit 2
    ;;
esac

readonly CLI_RPC_URL="$(
  awk '
    /^\[network_connection\.testnet\]$/ { in_testnet=1; next }
    /^\[/ { in_testnet=0 }
    in_testnet && /^rpc_url = / { gsub(/^rpc_url = "|"$/, ""); print; exit }
  ' /home/ubuntu/.config/near-cli/config.toml
)"
case "${CLI_RPC_URL%/}" in
  https://rpc.testnet.near.org | https://rpc.testnet.fastnear.com | https://archival-rpc.testnet.fastnear.com) ;;
  *)
    echo "Refusing unrecognised NEAR CLI Testnet RPC endpoint: $CLI_RPC_URL" >&2
    exit 2
    ;;
esac

mkdir -p "$EVIDENCE_DIRECTORY"
chmod 0700 "$EVIDENCE_DIRECTORY"

assert_testnet() {
  node - "$RPC_URL" <<'NODE'
const rpcUrl = process.argv[2];
const response = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-network-gate", method: "status", params: [] }),
  signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
const body = await response.json();
if (body.result?.chain_id !== "testnet") {
  throw new Error(`Refusing unexpected chain ${body.result?.chain_id ?? "unknown"}`);
}
console.log(`Verified NEAR ${body.result.chain_id} through ${rpcUrl}`);
NODE
}

view() {
  local account_id="$1"
  local method_name="$2"
  local args_json="${3:-}"
  if [[ -z "$args_json" ]]; then
    args_json='{}'
  fi
  node - "$RPC_URL" "$account_id" "$method_name" "$args_json" <<'NODE'
const [rpcUrl, accountId, methodName, argsJson] = process.argv.slice(2);
const response = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "clavis-view",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: accountId,
      method_name: methodName,
      args_base64: Buffer.from(argsJson).toString("base64"),
    },
  }),
  signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
const body = await response.json();
if (!body.result?.result) throw new Error(body.error?.data ?? body.error?.message ?? `${methodName} failed`);
process.stdout.write(Buffer.from(body.result.result).toString("utf8"));
NODE
}

account_code_hash() {
  local account_id="$1"
  node - "$RPC_URL" "$account_id" <<'NODE'
const [rpcUrl, accountId] = process.argv.slice(2);
const response = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "clavis-code-hash",
    method: "query",
    params: { request_type: "view_account", finality: "final", account_id: accountId },
  }),
  signal: AbortSignal.timeout(20_000),
});
const body = await response.json();
if (!body.result?.code_hash) throw new Error(body.error?.message ?? "Account lookup failed");
process.stdout.write(body.result.code_hash);
NODE
}

artifact_code_hash() {
  python3 - "$1" <<'PY'
from hashlib import sha256
from pathlib import Path
import sys

alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
digest = sha256(Path(sys.argv[1]).read_bytes()).digest()
number = int.from_bytes(digest, "big")
encoded = ""
while number:
    number, remainder = divmod(number, 58)
    encoded = alphabet[remainder] + encoded
padding = len(digest) - len(digest.lstrip(b"\0"))
print(alphabet[0] * padding + encoded)
PY
}

verify_keychain_public_key() {
  local account_id="$1"
  local expected_public_key="$2"
  local output
  if ! output="$(
    "$NEAR_BINARY" account get-public-key from-keychain "$account_id" \
      network-config testnet 2>&1
  )"; then
    echo "No usable secure-keychain signer was found for $account_id." >&2
    return 1
  fi
  if [[ "$output" != *"$expected_public_key"* ]]; then
    echo "The secure-keychain signer for $account_id has an unexpected public key." >&2
    return 1
  fi
  echo "Verified secure-keychain identity: $account_id"
}

verify_root_state() {
  local expected_hash="$1"
  local verification_mode="${2:-strict}"
  node --input-type=module - "$RPC_URL" "$BASELINE_PATH" "$expected_hash" "$verification_mode" <<'NODE'
import { readFile } from "node:fs/promises";
const [rpcUrl, baselinePath, expectedHash, verificationMode] = process.argv.slice(2);
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-root-verification", method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();
  if (body.error || body.result === undefined) throw new Error(body.error?.data ?? body.error?.message ?? "RPC failure");
  return body.result;
}
async function view(methodName, args = {}) {
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: "clavis.testnet",
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(result.result).toString("utf8"));
}
const account = await rpc("query", { request_type: "view_account", finality: "final", account_id: "clavis.testnet" });
if (account.code_hash !== expectedHash) throw new Error(`Root code hash ${account.code_hash} did not match ${expectedHash}`);
const actual = {
  owner: await view("get_owner"),
  agent: await view("get_agent"),
  version: await view("contract_version"),
  daily_limit: await view("get_daily_limit"),
  per_payment_limit: await view("get_per_payment_limit"),
  daily_spent: await view("get_daily_spent"),
  last_reset_timestamp: await view("get_last_reset_timestamp"),
  paused: await view("is_paused"),
  recipient_count: await view("get_recipient_count"),
  recipients: await view("get_recipients", { from: 0, limit: 100 }),
  log_count: await view("get_log_count"),
  audit: await view("get_audit_log_reverse", { from: 0, limit: 100 }),
  anomaly_count: await view("get_anomaly_count"),
  anomalies: await view("get_anomalies", { from: 0, limit: 100, active_only: false }),
  pending_recovery_at: await view("get_pending_native_payment_recovery_at"),
};
if (actual.version !== "0.2.0") throw new Error(`Unexpected root version ${actual.version}`);
if (actual.pending_recovery_at !== null) throw new Error("Migration created an unexpected pending payment");
if (verificationMode === "strict") {
  for (const key of [
    "owner", "agent", "daily_limit", "per_payment_limit", "daily_spent",
    "last_reset_timestamp", "paused", "recipient_count", "recipients", "log_count",
    "audit", "anomaly_count", "anomalies",
  ]) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(baseline.root[key])) {
      throw new Error(`Migrated root state differs at ${key}`);
    }
  }
  console.log(`Verified migrated root v${actual.version} with preserved policy and audit state.`);
} else if (verificationMode === "resume") {
  for (const key of [
    "owner", "agent", "daily_limit", "per_payment_limit", "last_reset_timestamp", "paused",
  ]) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(baseline.root[key])) {
      throw new Error(`Resume verification differs from the baseline at ${key}`);
    }
  }
  const actualRecipients = new Map(actual.recipients.map((entry) => [entry.recipient_hash, entry]));
  for (const expected of baseline.root.recipients) {
    if (JSON.stringify(actualRecipients.get(expected.recipient_hash)) !== JSON.stringify(expected)) {
      throw new Error(`Resume verification lost or changed baseline recipient ${expected.recipient_hash}`);
    }
  }
  const actualAudit = new Map(actual.audit.map((entry) => [entry.payment_id, entry]));
  for (const expected of baseline.root.audit) {
    if (JSON.stringify(actualAudit.get(expected.payment_id)) !== JSON.stringify(expected)) {
      throw new Error(`Resume verification lost or changed baseline audit ${expected.payment_id}`);
    }
  }
  const actualAnomalies = new Map(actual.anomalies.map((entry) => [entry.anomaly_id, entry]));
  for (const expected of baseline.root.anomalies) {
    if (JSON.stringify(actualAnomalies.get(expected.anomaly_id)) !== JSON.stringify(expected)) {
      throw new Error(`Resume verification lost or changed baseline anomaly ${expected.anomaly_id}`);
    }
  }
  if (actual.recipient_count < baseline.root.recipient_count || actual.log_count < baseline.root.log_count) {
    throw new Error("Resume verification observed a counter below the pre-migration baseline");
  }
  console.log(`Verified resume-safe root v${actual.version} state with the complete baseline preserved.`);
} else {
  throw new Error(`Unknown root verification mode ${verificationMode}`);
}
NODE
}

verify_factory_state() {
  local expected_hash="$1"
  node --input-type=module - "$RPC_URL" "$BASELINE_PATH" "$expected_hash" <<'NODE'
import { readFile } from "node:fs/promises";
const [rpcUrl, baselinePath, expectedHash] = process.argv.slice(2);
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-factory-verification", method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();
  if (body.error || body.result === undefined) throw new Error(body.error?.data ?? body.error?.message ?? "RPC failure");
  return body.result;
}
async function view(methodName, args = {}) {
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: "factory.clavis.testnet",
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(result.result).toString("utf8"));
}
const account = await rpc("query", { request_type: "view_account", finality: "final", account_id: "factory.clavis.testnet" });
if (account.code_hash !== expectedHash) throw new Error(`Factory code hash ${account.code_hash} did not match ${expectedHash}`);
const version = await view("contract_version");
const rootAccount = await view("get_root_account");
const contracts = await view("get_all_contracts");
if (version !== "0.2.0") throw new Error(`Unexpected factory version ${version}`);
if (rootAccount !== baseline.factory.root_account) throw new Error("Factory root account changed during upgrade");
if (JSON.stringify(contracts) !== JSON.stringify(baseline.factory.contracts)) {
  throw new Error("Factory contract registry changed during code upgrade");
}
console.log(`Verified factory v${version} with preserved registry state.`);
NODE
}

deploy_root() {
  local wasm_path="$ROOT_DIR/contract/res/clavis_contract.wasm"
  local expected_hash current_hash current_version baseline_hash
  expected_hash="$(artifact_code_hash "$wasm_path")"
  current_hash="$(account_code_hash "$ROOT_ACCOUNT")"
  current_version="$(view "$ROOT_ACCOUNT" contract_version '{}')"
  baseline_hash="$(node -e 'const b=require(process.argv[1]);process.stdout.write(b.accounts["clavis.testnet"].code_hash)' "$BASELINE_PATH")"

  if [[ "$current_version" == '"0.2.0"' && "$current_hash" == "$expected_hash" ]]; then
    verify_root_state "$expected_hash" resume
    echo "Root already matches the reviewed v0.2 artifact; no transaction submitted."
    return
  fi
  [[ "$current_version" == '"0.1.0"' ]] || {
    echo "Refusing root migration from unexpected version $current_version" >&2
    exit 1
  }
  [[ "$current_hash" == "$baseline_hash" ]] || {
    echo "Refusing root migration because live code changed after baseline capture." >&2
    exit 1
  }
  verify_keychain_public_key "$ROOT_ACCOUNT" "$ROOT_PUBLIC_KEY"
  assert_testnet
  echo "Deploying reviewed root v0.2 artifact and executing stored-owner migration..."
  "$NEAR_BINARY" contract deploy "$ROOT_ACCOUNT" \
    use-file "$wasm_path" \
    with-init-call migrate json-args '{}' \
    prepaid-gas "100 TeraGas" \
    attached-deposit "0 NEAR" \
    network-config testnet \
    sign-with-keychain --signer-public-key "$ROOT_PUBLIC_KEY" \
    send --wait-until final 2>&1 \
    | tee "$EVIDENCE_DIRECTORY/root-deploy.log"
  chmod 0600 "$EVIDENCE_DIRECTORY/root-deploy.log"
  verify_root_state "$expected_hash"
}

deploy_factory() {
  local wasm_path="$ROOT_DIR/contract/res/clavis_factory.wasm"
  local expected_hash current_hash baseline_hash
  expected_hash="$(artifact_code_hash "$wasm_path")"
  current_hash="$(account_code_hash "$FACTORY_ACCOUNT")"
  baseline_hash="$(node -e 'const b=require(process.argv[1]);process.stdout.write(b.accounts["factory.clavis.testnet"].code_hash)' "$BASELINE_PATH")"

  if [[ "$current_hash" == "$expected_hash" ]]; then
    verify_factory_state "$expected_hash"
    echo "Factory already matches the reviewed v0.2 artifact; no transaction submitted."
    return
  fi
  [[ "$current_hash" == "$baseline_hash" ]] || {
    echo "Refusing factory upgrade because live code changed after baseline capture." >&2
    exit 1
  }
  verify_keychain_public_key "$FACTORY_ACCOUNT" "$FACTORY_PUBLIC_KEY"
  assert_testnet
  echo "Deploying the state-compatible factory v0.2 artifact..."
  "$NEAR_BINARY" contract deploy "$FACTORY_ACCOUNT" \
    use-file "$wasm_path" \
    without-init-call \
    network-config testnet \
    sign-with-keychain --signer-public-key "$FACTORY_PUBLIC_KEY" \
    send --wait-until final 2>&1 \
    | tee "$EVIDENCE_DIRECTORY/factory-deploy.log"
  chmod 0600 "$EVIDENCE_DIRECTORY/factory-deploy.log"
  verify_factory_state "$expected_hash"
}

assert_testnet
"$ROOT_DIR/scripts/build-contracts.sh"
sha256sum \
  "$ROOT_DIR/contract/res/clavis_contract.wasm" \
  "$ROOT_DIR/contract/res/clavis_factory.wasm" \
  | tee "$EVIDENCE_DIRECTORY/artifact-sha256.txt"
chmod 0600 "$EVIDENCE_DIRECTORY/artifact-sha256.txt"

if [[ "$PHASE" == "all" || "$PHASE" == "root" ]]; then
  deploy_root
fi
if [[ "$PHASE" == "all" || "$PHASE" == "factory" ]]; then
  deploy_factory
fi

echo "Requested Clavis v0.2 deployment phase completed: $PHASE"
