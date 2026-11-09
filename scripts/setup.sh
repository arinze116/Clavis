#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

: "${OWNER_ID:?Set OWNER_ID in .env}"
: "${CONTRACT_ID:?Set CONTRACT_ID in .env}"

WORKER_ONE_ID="${WORKER_ONE_ID:-worker-one.testnet}"
WORKER_TWO_ID="${WORKER_TWO_ID:-worker-two.testnet}"
WORKER_THREE_ID="${WORKER_THREE_ID:-worker-three.testnet}"
export WORKER_ONE_ID WORKER_TWO_ID WORKER_THREE_ID

hash_address() {
  node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(process.argv[1]).digest("hex"))' "$1"
}

call_owner() {
  local method="$1"
  local args="$2"
  near contract call-function as-transaction "$CONTRACT_ID" "$method" json-args "$args" \
    prepaid-gas "100 TeraGas" \
    attached-deposit "0 NEAR" \
    sign-as "$OWNER_ID" \
    network-config testnet \
    sign-with-legacy-keychain \
    send
}

add_recipient() {
  local address="$1"
  local name="$2"
  local cap="$3"
  local chain="$4"
  local token="$5"
  local schedule="$6"
  local recipient_hash
  recipient_hash="$(hash_address "$address")"
  local args
  args=$(node -e 'process.stdout.write(JSON.stringify({recipient_hash: process.argv[1], config: {name: process.argv[2], personal_cap: process.argv[3], active: true, preferred_chain: process.argv[4], preferred_token: process.argv[5], payment_split: [], schedule: process.argv[6]}}))' "$recipient_hash" "$name" "$cap" "$chain" "$token" "$schedule")
  call_owner add_recipient "$args"
}

echo "Adding three deterministic testnet recipients..."
add_recipient "$WORKER_ONE_ID" "Ada" "10000000000000000000000000" near NEAR Weekly
add_recipient "$WORKER_TWO_ID" "Sarah" "12000000000000000000000000" near NEAR Biweekly
add_recipient "$WORKER_THREE_ID" "Chidi" "8000000000000000000000000" near NEAR Milestone

node "$ROOT_DIR/scripts/generate-demo-payroll.mjs"
echo "Demo policy and private payroll plan are ready."
