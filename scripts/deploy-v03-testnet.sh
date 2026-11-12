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
readonly RPC_URL="${NEAR_RPC_URL:-https://test.rpc.fastnear.com}"
readonly NEAR_CONNECTION="${CLAVIS_NEAR_NETWORK_CONNECTION:-testnet}"
readonly EVIDENCE_DIRECTORY="${CLAVIS_V03_EVIDENCE_DIRECTORY:-/home/ubuntu/.local/state/clavis-v03-20261112}"
readonly PHASE="${1:-all}"
readonly ROOT_WASM="$ROOT_DIR/contract/res/clavis_contract.wasm"
readonly FACTORY_WASM="$ROOT_DIR/contract/res/clavis_factory.wasm"
readonly SNAPSHOT_PATH="$EVIDENCE_DIRECTORY/pre-deployment-state.json"

case "$PHASE" in
  all | root | factory | verify) ;;
  *)
    echo "Usage: bash scripts/deploy-v03-testnet.sh [all|root|factory|verify]" >&2
    exit 2
    ;;
esac

[[ "${CLAVIS_NEAR_KEYRING_ACTIVE:-}" == "1" ]] || {
  echo "Run through scripts/run-with-clavis-near-keyring.sh." >&2
  exit 2
}
[[ -x "$NEAR_BINARY" ]] || { echo "Pinned NEAR CLI is unavailable." >&2; exit 2; }
[[ "$ROOT_ACCOUNT" == *.testnet && "$FACTORY_ACCOUNT" == *.testnet ]] || {
  echo "Deployment accounts must be on Testnet." >&2
  exit 2
}
case "${RPC_URL%/}" in
  https://test.rpc.fastnear.com | https://near-testnet.drpc.org | https://testnet-rpc.intea.rs | https://archival-rpc.testnet.near.org) ;;
  *) echo "Refusing unrecognised Testnet RPC endpoint: $RPC_URL" >&2; exit 2 ;;
esac
case "$NEAR_CONNECTION" in
  testnet | testnet-drpc) ;;
  *) echo "Refusing unrecognised Testnet connection: $NEAR_CONNECTION" >&2; exit 2 ;;
esac

mkdir -p "$EVIDENCE_DIRECTORY"
chmod 0700 "$EVIDENCE_DIRECTORY"

assert_testnet() {
  node - "$RPC_URL" <<'NODE'
const rpcUrl = process.argv[2];
const response = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-v03-network", method: "status", params: [] }),
  signal: AbortSignal.timeout(20_000),
});
const body = await response.json();
if (body.result?.chain_id !== "testnet") {
  throw new Error(`Refusing unexpected chain ${body.result?.chain_id ?? "unknown"}`);
}
console.log(`Verified NEAR ${body.result.chain_id}`);
NODE
}

view() {
  local account_id="$1"
  local method_name="$2"
  local args_json="${3:-{}}"
  node - "$RPC_URL" "$account_id" "$method_name" "$args_json" <<'NODE'
const [rpcUrl, accountId, methodName, argsJson] = process.argv.slice(2);
const response = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "clavis-v03-view",
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
const body = await response.json();
if (!body.result?.result) throw new Error(body.error?.message ?? `${methodName} failed`);
process.stdout.write(Buffer.from(body.result.result).toString("utf8"));
NODE
}

account_code_hash() {
  node - "$RPC_URL" "$1" <<'NODE'
const [rpcUrl, accountId] = process.argv.slice(2);
const response = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "clavis-v03-code",
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
  output="$(
    "$NEAR_BINARY" account get-public-key from-keychain "$account_id" \
      network-config "$NEAR_CONNECTION" 2>&1
  )" || {
    echo "No usable secure-keychain signer was found for $account_id." >&2
    return 1
  }
  [[ "$output" == *"$expected_public_key"* ]] || {
    echo "The secure-keychain signer for $account_id has an unexpected public key." >&2
    return 1
  }
  echo "Verified secure-keychain identity: $account_id"
}

capture_snapshot() {
  node --input-type=module - "$RPC_URL" "$SNAPSHOT_PATH" <<'NODE'
import { writeFile } from "node:fs/promises";
const [rpcUrl, outputPath] = process.argv.slice(2);
async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-v03-snapshot", method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();
  if (body.error || body.result === undefined) throw new Error(body.error?.message ?? "RPC failure");
  return body.result;
}
async function view(accountId, methodName, args = {}) {
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(result.result).toString("utf8"));
}
const root = {
  version: await view("clavis.testnet", "contract_version"),
  owner: await view("clavis.testnet", "get_owner"),
  agent: await view("clavis.testnet", "get_agent"),
  daily_limit: await view("clavis.testnet", "get_daily_limit"),
  per_payment_limit: await view("clavis.testnet", "get_per_payment_limit"),
  daily_spent: await view("clavis.testnet", "get_daily_spent"),
  last_reset_timestamp: await view("clavis.testnet", "get_last_reset_timestamp"),
  paused: await view("clavis.testnet", "is_paused"),
  recipients: await view("clavis.testnet", "get_recipients", { from: 0, limit: 100 }),
  audit: await view("clavis.testnet", "get_audit_log_reverse", { from: 0, limit: 100 }),
  anomalies: await view("clavis.testnet", "get_anomalies", { from: 0, limit: 100, active_only: false }),
  pending_recovery_at: await view("clavis.testnet", "get_pending_native_payment_recovery_at"),
};
const factory = {
  version: await view("factory.clavis.testnet", "contract_version"),
  root_account: await view("factory.clavis.testnet", "get_root_account"),
  contracts: await view("factory.clavis.testnet", "get_all_contracts"),
};
if (root.version !== "0.2.0" && root.version !== "0.3.0") throw new Error(`Unexpected root version ${root.version}`);
if (factory.version !== "0.2.0" && factory.version !== "0.3.0") throw new Error(`Unexpected factory version ${factory.version}`);
if (root.pending_recovery_at !== null) throw new Error("Root has a pending native settlement");
await writeFile(outputPath, `${JSON.stringify({ captured_at: new Date().toISOString(), root, factory }, null, 2)}\n`, { mode: 0o600 });
NODE
}

verify_post_state() {
  node --input-type=module - "$RPC_URL" "$SNAPSHOT_PATH" "$1" "$2" <<'NODE'
import { readFile } from "node:fs/promises";
const [rpcUrl, snapshotPath, expectedRootHash, expectedFactoryHash] = process.argv.slice(2);
const before = JSON.parse(await readFile(snapshotPath, "utf8"));
async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-v03-verify", method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();
  if (body.error || body.result === undefined) throw new Error(body.error?.message ?? "RPC failure");
  return body.result;
}
async function view(accountId, methodName, args = {}) {
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(result.result).toString("utf8"));
}
const rootAccount = await rpc("query", { request_type: "view_account", finality: "final", account_id: "clavis.testnet" });
const factoryAccount = await rpc("query", { request_type: "view_account", finality: "final", account_id: "factory.clavis.testnet" });
if (rootAccount.code_hash !== expectedRootHash) throw new Error("Root code hash mismatch");
if (factoryAccount.code_hash !== expectedFactoryHash) throw new Error("Factory code hash mismatch");
const root = {
  owner: await view("clavis.testnet", "get_owner"),
  agent: await view("clavis.testnet", "get_agent"),
  daily_limit: await view("clavis.testnet", "get_daily_limit"),
  per_payment_limit: await view("clavis.testnet", "get_per_payment_limit"),
  daily_spent: await view("clavis.testnet", "get_daily_spent"),
  last_reset_timestamp: await view("clavis.testnet", "get_last_reset_timestamp"),
  paused: await view("clavis.testnet", "is_paused"),
  recipients: await view("clavis.testnet", "get_recipients", { from: 0, limit: 100 }),
  audit: await view("clavis.testnet", "get_audit_log_reverse", { from: 0, limit: 100 }),
  anomalies: await view("clavis.testnet", "get_anomalies", { from: 0, limit: 100, active_only: false }),
};
for (const key of Object.keys(root)) {
  if (JSON.stringify(root[key]) !== JSON.stringify(before.root[key])) {
    throw new Error(`Root state changed unexpectedly at ${key}`);
  }
}
if (await view("clavis.testnet", "contract_version") !== "0.3.0") throw new Error("Root version is not 0.3.0");
if (await view("clavis.testnet", "get_pending_native_payment_recovery_at") !== null) throw new Error("Migration created a pending settlement");
if (await view("factory.clavis.testnet", "contract_version") !== "0.3.0") throw new Error("Factory version is not 0.3.0");
if (await view("factory.clavis.testnet", "get_root_account") !== before.factory.root_account) throw new Error("Factory root account changed");
if (JSON.stringify(await view("factory.clavis.testnet", "get_all_contracts")) !== JSON.stringify(before.factory.contracts)) throw new Error("Factory registry changed");
if (await view("clavis.testnet", "is_payment_reference_completed", { recipient_hash: "0".repeat(64), payment_reference: "verification" })) throw new Error("Fresh payment reference unexpectedly completed");
console.log("Verified v0.3 root migration, factory upgrade, preserved state, and milestone reference storage.");
NODE
}

assert_testnet
bash "$ROOT_DIR/scripts/build-contracts.sh"
sha256sum "$ROOT_WASM" "$FACTORY_WASM" | tee "$EVIDENCE_DIRECTORY/artifact-sha256.txt"
chmod 0600 "$EVIDENCE_DIRECTORY/artifact-sha256.txt"
capture_snapshot

readonly EXPECTED_ROOT_HASH="$(artifact_code_hash "$ROOT_WASM")"
readonly EXPECTED_FACTORY_HASH="$(artifact_code_hash "$FACTORY_WASM")"

if [[ "$PHASE" == "all" || "$PHASE" == "root" ]]; then
  current_version="$(view "$ROOT_ACCOUNT" contract_version '{}')"
  current_hash="$(account_code_hash "$ROOT_ACCOUNT")"
  if [[ "$current_version" != '"0.3.0"' || "$current_hash" != "$EXPECTED_ROOT_HASH" ]]; then
    [[ "$current_version" == '"0.2.0"' ]] || { echo "Refusing root upgrade from $current_version" >&2; exit 1; }
    verify_keychain_public_key "$ROOT_ACCOUNT" "$ROOT_PUBLIC_KEY"
    "$NEAR_BINARY" contract deploy "$ROOT_ACCOUNT" \
      use-file "$ROOT_WASM" \
      with-init-call migrate json-args '{}' \
      prepaid-gas "100 TeraGas" \
      attached-deposit "0 NEAR" \
      network-config "$NEAR_CONNECTION" \
      sign-with-keychain --signer-public-key "$ROOT_PUBLIC_KEY" \
      send --wait-until final 2>&1 | tee "$EVIDENCE_DIRECTORY/root-deploy.log"
    chmod 0600 "$EVIDENCE_DIRECTORY/root-deploy.log"
  fi
fi

if [[ "$PHASE" == "all" || "$PHASE" == "factory" ]]; then
  current_version="$(view "$FACTORY_ACCOUNT" contract_version '{}')"
  current_hash="$(account_code_hash "$FACTORY_ACCOUNT")"
  if [[ "$current_version" != '"0.3.0"' || "$current_hash" != "$EXPECTED_FACTORY_HASH" ]]; then
    [[ "$current_version" == '"0.2.0"' ]] || { echo "Refusing factory upgrade from $current_version" >&2; exit 1; }
    verify_keychain_public_key "$FACTORY_ACCOUNT" "$FACTORY_PUBLIC_KEY"
    "$NEAR_BINARY" contract deploy "$FACTORY_ACCOUNT" \
      use-file "$FACTORY_WASM" \
      without-init-call \
      network-config "$NEAR_CONNECTION" \
      sign-with-keychain --signer-public-key "$FACTORY_PUBLIC_KEY" \
      send --wait-until final 2>&1 | tee "$EVIDENCE_DIRECTORY/factory-deploy.log"
    chmod 0600 "$EVIDENCE_DIRECTORY/factory-deploy.log"
  fi
fi

if [[ "$PHASE" == "verify" ]]; then
  [[ -f "$SNAPSHOT_PATH" ]] || { echo "Missing deployment snapshot: $SNAPSHOT_PATH" >&2; exit 1; }
fi

if [[ "$PHASE" == "all" || "$PHASE" == "verify" ]]; then
  verify_post_state "$EXPECTED_ROOT_HASH" "$EXPECTED_FACTORY_HASH"
fi

echo "Completed Clavis v0.3 Testnet deployment phase: $PHASE"
