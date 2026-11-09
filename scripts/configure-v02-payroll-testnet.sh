#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly NEAR_BINARY="/home/ubuntu/.local/lib/clavis-near/near-v0.31.1/near"
readonly RPC_URL="${NEAR_RPC_URL:-https://rpc.testnet.fastnear.com}"
readonly CONTRACT_ID="clavis.testnet"
readonly OWNER_ID="clavis.testnet"
readonly OWNER_PUBLIC_KEY="ed25519:Bzk9o3X52NXSWU8GW2HXFiRWj8TdLYzVKSZQxi7vDq8c"
readonly WORKER_ONE_ID="arinze-worker1.testnet"
readonly WORKER_ONE_PUBLIC_KEY="ed25519:Htw1X9TG7TwXcMPywYjiRkngX6dUYPxktLWf46KkBmxt"
readonly WORKER_TWO_ID="arinze-worker2.testnet"
readonly FAILURE_ACCOUNT_ID="clavis-failed-transfer-probe.testnet"
readonly STANDARD_CAP="100000000000000000000000"
readonly INSUFFICIENT_CAP="20000000000000000000000000"
readonly PROBE_AMOUNT="1000000000000000000000"
readonly EVIDENCE_DIRECTORY="${CLAVIS_BASELINE_DIRECTORY:-/home/ubuntu/.local/state/clavis-v02-20261109}/execution"
readonly PHASE="${1:-workers}"

case "$PHASE" in
  workers | add-failure-probe | remove-failure-probe | prepare-insufficient | restore-worker2 | unauthorized-probe) ;;
  *)
    echo "Usage: bash scripts/configure-v02-payroll-testnet.sh <workers|add-failure-probe|remove-failure-probe|prepare-insufficient|restore-worker2|unauthorized-probe>" >&2
    exit 2
    ;;
esac

[[ "${CLAVIS_NEAR_KEYRING_ACTIVE:-}" == "1" ]] || {
  echo "Run this script through scripts/run-with-clavis-near-keyring.sh." >&2
  exit 2
}
for account_id in "$CONTRACT_ID" "$OWNER_ID" "$WORKER_ONE_ID" "$WORKER_TWO_ID" "$FAILURE_ACCOUNT_ID"; do
  [[ "$account_id" == *.testnet ]] || { echo "Refusing non-Testnet account: $account_id" >&2; exit 2; }
done
case "${RPC_URL%/}" in
  https://rpc.testnet.near.org | https://rpc.testnet.fastnear.com | https://archival-rpc.testnet.fastnear.com) ;;
  *) echo "Refusing unrecognised Testnet RPC endpoint: $RPC_URL" >&2; exit 2 ;;
esac
mkdir -p "$EVIDENCE_DIRECTORY"
chmod 0700 "$EVIDENCE_DIRECTORY"

hash_account() {
  node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(process.argv[1]).digest("hex"))' "$1"
}

readonly WORKER_ONE_HASH="$(hash_account "$WORKER_ONE_ID")"
readonly WORKER_TWO_HASH="$(hash_account "$WORKER_TWO_ID")"
readonly FAILURE_HASH="$(hash_account "$FAILURE_ACCOUNT_ID")"

rpc() {
  local request_type="$1"
  local account_id="$2"
  local method_name="${3:-}"
  local args_json="${4:-}"
  if [[ -z "$args_json" ]]; then
    args_json='{}'
  fi
  node - "$RPC_URL" "$request_type" "$account_id" "$method_name" "$args_json" <<'NODE'
const [rpcUrl, requestType, accountId, methodName, argsJson] = process.argv.slice(2);
const params = requestType === "call_function"
  ? {
      request_type: requestType,
      finality: "final",
      account_id: accountId,
      method_name: methodName,
      args_base64: Buffer.from(argsJson).toString("base64"),
    }
  : { request_type: requestType, finality: "final", account_id: accountId };
const response = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-configure", method: "query", params }),
  signal: AbortSignal.timeout(20_000),
});
const body = await response.json();
if (body.error || body.result === undefined) throw new Error(body.error?.data ?? body.error?.message ?? "RPC failure");
if (requestType === "call_function") process.stdout.write(Buffer.from(body.result.result).toString("utf8"));
else process.stdout.write(JSON.stringify(body.result));
NODE
}

assert_testnet() {
  node - "$RPC_URL" <<'NODE'
const response = await fetch(process.argv[2], {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-configure-network", method: "status", params: [] }),
  signal: AbortSignal.timeout(20_000),
});
const body = await response.json();
if (body.result?.chain_id !== "testnet") throw new Error(`Refusing chain ${body.result?.chain_id ?? "unknown"}`);
NODE
}

view() {
  local args_json="${2:-}"
  if [[ -z "$args_json" ]]; then
    args_json='{}'
  fi
  rpc call_function "$CONTRACT_ID" "$1" "$args_json"
}

verify_keychain_public_key() {
  local account_id="$1"
  local expected_public_key="$2"
  local output
  output="$(
    "$NEAR_BINARY" account get-public-key from-keychain "$account_id" \
      network-config testnet 2>&1
  )" || { echo "Secure-keychain signer unavailable for $account_id" >&2; exit 1; }
  [[ "$output" == *"$expected_public_key"* ]] || {
    echo "Unexpected secure-keychain identity for $account_id" >&2
    exit 1
  }
}

call_as() {
  local signer_id="$1"
  local signer_public_key="$2"
  local method_name="$3"
  local args_json="$4"
  local log_name="$5"
  assert_testnet
  "$NEAR_BINARY" contract call-function as-transaction "$CONTRACT_ID" "$method_name" \
    json-args "$args_json" \
    prepaid-gas "100 TeraGas" \
    attached-deposit "0 NEAR" \
    sign-as "$signer_id" \
    network-config testnet \
    sign-with-keychain --signer-public-key "$signer_public_key" \
    send --wait-until final 2>&1 \
    | tee "$EVIDENCE_DIRECTORY/$log_name.log"
  chmod 0600 "$EVIDENCE_DIRECTORY/$log_name.log"
}

call_owner() {
  call_as "$OWNER_ID" "$OWNER_PUBLIC_KEY" "$1" "$2" "$3"
}

recipient_json() {
  view get_recipient "$(node -e 'process.stdout.write(JSON.stringify({recipient_hash:process.argv[1]}))' "$1")"
}

recipient_last_paid() {
  recipient_json "$1" \
    | node -e 'let value="";process.stdin.on("data",chunk=>value+=chunk).on("end",()=>process.stdout.write(String(JSON.parse(value).last_paid)))'
}

account_amount() {
  rpc view_account "$1" \
    | node -e 'let value="";process.stdin.on("data",chunk=>value+=chunk).on("end",()=>process.stdout.write(JSON.parse(value).amount))'
}

verify_recipient() {
  local recipient_hash="$1"
  local expected_name="$2"
  local expected_cap="$3"
  local expected_schedule="$4"
  local actual
  actual="$(recipient_json "$recipient_hash")"
  node - "$actual" "$expected_name" "$expected_cap" "$expected_schedule" <<'NODE'
const [raw, name, cap, schedule] = process.argv.slice(2);
const value = JSON.parse(raw);
if (!value) throw new Error("Recipient is missing after confirmed transaction");
const expected = { name, personal_cap: cap, active: true, preferred_chain: "near", preferred_token: "NEAR", schedule };
for (const [key, expectedValue] of Object.entries(expected)) {
  if (value[key] !== expectedValue) throw new Error(`Recipient ${key}=${value[key]} did not match ${expectedValue}`);
}
if (!Array.isArray(value.payment_split) || value.payment_split.length !== 0) {
  throw new Error("Recipient payment split must be empty for native settlement");
}
NODE
}

add_recipient_if_missing() {
  local account_id="$1"
  local recipient_hash="$2"
  local name="$3"
  local cap="$4"
  local schedule="$5"
  local current args
  current="$(recipient_json "$recipient_hash")"
  if [[ "$current" == "null" ]]; then
    args="$(node -e 'process.stdout.write(JSON.stringify({recipient_hash:process.argv[1],config:{name:process.argv[2],personal_cap:process.argv[3],active:true,preferred_chain:"near",preferred_token:"NEAR",payment_split:[],schedule:process.argv[4]}}))' "$recipient_hash" "$name" "$cap" "$schedule")"
    call_owner add_recipient "$args" "add-${account_id//./-}"
  fi
  verify_recipient "$recipient_hash" "$name" "$cap" "$schedule"
}

update_cap() {
  local recipient_hash="$1"
  local cap="$2"
  local label="$3"
  local args
  args="$(node -e 'process.stdout.write(JSON.stringify({recipient_hash:process.argv[1],personal_cap:process.argv[2]}))' "$recipient_hash" "$cap")"
  call_owner update_recipient_cap "$args" "$label-cap"
}

update_schedule() {
  local recipient_hash="$1"
  local schedule="$2"
  local label="$3"
  local args
  args="$(node -e 'process.stdout.write(JSON.stringify({recipient_hash:process.argv[1],schedule:process.argv[2]}))' "$recipient_hash" "$schedule")"
  call_owner update_schedule "$args" "$label-schedule"
}

assert_testnet
[[ "$(view contract_version '{}')" == '"0.2.0"' ]] || {
  echo "The root contract must report v0.2.0 before payroll configuration." >&2
  exit 1
}
verify_keychain_public_key "$OWNER_ID" "$OWNER_PUBLIC_KEY"

case "$PHASE" in
  workers)
    add_recipient_if_missing "$WORKER_ONE_ID" "$WORKER_ONE_HASH" "Arinze Worker 1" "$STANDARD_CAP" Weekly
    add_recipient_if_missing "$WORKER_TWO_ID" "$WORKER_TWO_HASH" "Arinze Worker 2" "$STANDARD_CAP" Weekly
    ;;
  add-failure-probe)
    add_recipient_if_missing "$FAILURE_ACCOUNT_ID" "$FAILURE_HASH" "Failed Transfer Probe" "$STANDARD_CAP" Milestone
    ;;
  remove-failure-probe)
    if [[ "$(recipient_json "$FAILURE_HASH")" != "null" ]]; then
      call_owner remove_recipient \
        "$(node -e 'process.stdout.write(JSON.stringify({recipient_hash:process.argv[1]}))' "$FAILURE_HASH")" \
        remove-failed-transfer-probe
    fi
    [[ "$(recipient_json "$FAILURE_HASH")" == "null" ]] || {
      echo "Failed-transfer probe recipient still exists after removal." >&2
      exit 1
    }
    ;;
  prepare-insufficient)
    update_cap "$WORKER_TWO_HASH" "$INSUFFICIENT_CAP" worker2-insufficient
    update_schedule "$WORKER_TWO_HASH" Milestone worker2-insufficient
    verify_recipient "$WORKER_TWO_HASH" "Arinze Worker 2" "$INSUFFICIENT_CAP" Milestone
    ;;
  restore-worker2)
    update_cap "$WORKER_TWO_HASH" "$STANDARD_CAP" worker2-restore
    update_schedule "$WORKER_TWO_HASH" Weekly worker2-restore
    verify_recipient "$WORKER_TWO_HASH" "Arinze Worker 2" "$STANDARD_CAP" Weekly
    ;;
  unauthorized-probe)
    verify_keychain_public_key "$WORKER_ONE_ID" "$WORKER_ONE_PUBLIC_KEY"
    before_log_count="$(view get_log_count '{}')"
    before_daily_spent="$(view get_daily_spent '{}')"
    before_last_paid="$(recipient_last_paid "$WORKER_ONE_HASH")"
    before_contract_balance="$(account_amount "$CONTRACT_ID")"
    args="$(node -e 'process.stdout.write(JSON.stringify({recipient_hash:process.argv[1],amount:process.argv[2],chain:"near",token:"NEAR",recipient_account_id:process.argv[3]}))' "$WORKER_ONE_HASH" "$PROBE_AMOUNT" "$WORKER_ONE_ID")"
    call_as "$WORKER_ONE_ID" "$WORKER_ONE_PUBLIC_KEY" request_payment "$args" unauthorized-worker-request
    after_log_count="$(view get_log_count '{}')"
    after_daily_spent="$(view get_daily_spent '{}')"
    after_last_paid="$(recipient_last_paid "$WORKER_ONE_HASH")"
    after_contract_balance="$(account_amount "$CONTRACT_ID")"
    [[ "$before_log_count" == "$after_log_count" ]] || {
      echo "Unauthorized request changed the audit log." >&2
      exit 1
    }
    [[ "$before_daily_spent" == "$after_daily_spent" ]] || {
      echo "Unauthorized request changed daily spend." >&2
      exit 1
    }
    [[ "$before_last_paid" == "$after_last_paid" ]] || {
      echo "Unauthorized request changed the worker schedule or policy." >&2
      exit 1
    }
    [[ "$before_contract_balance" == "$after_contract_balance" ]] || {
      echo "Unauthorized request changed the contract treasury balance." >&2
      exit 1
    }
    ;;
esac

echo "Verified v0.2 payroll configuration phase: $PHASE"
