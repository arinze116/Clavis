#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly NEAR_BINARY="/home/ubuntu/.local/lib/clavis-near/near-v0.31.1/near"
readonly SIGNER_BINARY="/home/ubuntu/.local/lib/clavis-near/clavis-near-signer"
readonly OWNER_PUBLIC_KEY="ed25519:Bzk9o3X52NXSWU8GW2HXFiRWj8TdLYzVKSZQxi7vDq8c"
readonly RPC_URL="${NEAR_RPC_URL:-https://rpc.testnet.fastnear.com}"
readonly EVIDENCE_DIRECTORY="${CLAVIS_BASELINE_DIRECTORY:-/home/ubuntu/.local/state/clavis-v02-20261109}/execution"
readonly SIGNER_REPORT="$ROOT_DIR/docs/reports/clavis-near-signer-connection-20261109.md"

[[ "${CLAVIS_NEAR_KEYRING_ACTIVE:-}" == "1" ]] || {
  echo "Run this script through scripts/run-with-clavis-near-keyring.sh." >&2
  exit 2
}
case "${RPC_URL%/}" in
  https://rpc.testnet.near.org | https://rpc.testnet.fastnear.com | https://archival-rpc.testnet.fastnear.com) ;;
  *) echo "Refusing unrecognised Testnet RPC endpoint: $RPC_URL" >&2; exit 2 ;;
esac
mkdir -p "$EVIDENCE_DIRECTORY"
chmod 0700 "$EVIDENCE_DIRECTORY"

failure_probe_added=0
insufficient_prepared=0
factory_upgraded=0

root_version() {
  node - "$RPC_URL" <<'NODE'
const rpcUrl = process.argv[2];
const statusResponse = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-execute-network", method: "status", params: [] }),
  signal: AbortSignal.timeout(20_000),
});
const status = await statusResponse.json();
if (status.result?.chain_id !== "testnet") throw new Error(`Refusing chain ${status.result?.chain_id ?? "unknown"}`);
const response = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "clavis-execute-version",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: "clavis.testnet",
      method_name: "contract_version",
      args_base64: "e30=",
    },
  }),
  signal: AbortSignal.timeout(20_000),
});
const body = await response.json();
if (!body.result?.result) throw new Error(body.error?.message ?? "contract_version failed");
process.stdout.write(JSON.parse(Buffer.from(body.result.result).toString("utf8")));
NODE
}

cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$insufficient_prepared" == "1" ]]; then
    "$ROOT_DIR/scripts/configure-v02-payroll-testnet.sh" restore-worker2 || status=1
  fi
  if [[ "$failure_probe_added" == "1" ]]; then
    "$ROOT_DIR/scripts/configure-v02-payroll-testnet.sh" remove-failure-probe || status=1
  fi
  if [[ "$(root_version 2>/dev/null || true)" == "0.1.0" ]]; then
    pm2 restart clavis-agent --update-env >/dev/null || status=1
  else
    pm2 stop clavis-agent >/dev/null || status=1
    echo "Deployment stopped before completion; clavis-agent remains fail-closed for inspection." >&2
  fi
  exit "$status"
}
trap cleanup EXIT

owner_key_output="$(
  "$NEAR_BINARY" account get-public-key from-keychain clavis.testnet \
    network-config testnet 2>&1
)" || { echo "The owner secure-keychain signer is unavailable." >&2; exit 1; }
[[ "$owner_key_output" == *"$OWNER_PUBLIC_KEY"* ]] || {
  echo "The owner secure-keychain signer has an unexpected public key." >&2
  exit 1
}

"$SIGNER_BINARY" verify-existing \
  --near-binary "$NEAR_BINARY" \
  --report "$SIGNER_REPORT"

pm2 stop clavis-agent >/dev/null

"$ROOT_DIR/scripts/deploy-v02-testnet.sh" root

if "$ROOT_DIR/scripts/deploy-v02-testnet.sh" factory; then
  factory_upgraded=1
  printf '%s\n' "factory-upgraded" > "$EVIDENCE_DIRECTORY/factory-status.txt"
else
  printf '%s\n' "factory-signer-unavailable" > "$EVIDENCE_DIRECTORY/factory-status.txt"
  echo "Factory signer unavailable; continuing every root, agent, and payroll acceptance test." >&2
fi
chmod 0600 "$EVIDENCE_DIRECTORY/factory-status.txt"

"$ROOT_DIR/scripts/deploy-v02-agent-testnet.sh" prepare

"$ROOT_DIR/scripts/configure-v02-payroll-testnet.sh" workers
"$ROOT_DIR/scripts/configure-v02-payroll-testnet.sh" unauthorized-probe

"$ROOT_DIR/scripts/configure-v02-payroll-testnet.sh" add-failure-probe
failure_probe_added=1
node --import tsx "$ROOT_DIR/scripts/v02-testnet-acceptance.ts" failed-transfer
"$ROOT_DIR/scripts/configure-v02-payroll-testnet.sh" remove-failure-probe
failure_probe_added=0

node --import tsx "$ROOT_DIR/scripts/v02-testnet-acceptance.ts" agent-permission
node --import tsx "$ROOT_DIR/scripts/v02-testnet-acceptance.ts" invalid-recipient
node --import tsx "$ROOT_DIR/scripts/v02-testnet-acceptance.ts" payroll-before
"$ROOT_DIR/scripts/deploy-v02-agent-testnet.sh" run-once
node --import tsx "$ROOT_DIR/scripts/v02-testnet-acceptance.ts" payroll-after
node --import tsx "$ROOT_DIR/scripts/v02-testnet-acceptance.ts" duplicate-worker1

"$ROOT_DIR/scripts/configure-v02-payroll-testnet.sh" prepare-insufficient
insufficient_prepared=1
node --import tsx "$ROOT_DIR/scripts/v02-testnet-acceptance.ts" insufficient-worker2
"$ROOT_DIR/scripts/configure-v02-payroll-testnet.sh" restore-worker2
insufficient_prepared=0

node --import tsx "$ROOT_DIR/scripts/v02-testnet-acceptance.ts" snapshot
"$ROOT_DIR/scripts/deploy-v02-agent-testnet.sh" start

trap - EXIT
if [[ "$factory_upgraded" == "1" ]]; then
  echo "Root, factory, agent, and payroll Testnet execution completed."
else
  echo "Root, agent, and payroll Testnet execution completed; factory upgrade remains blocked by its separate signer."
fi
