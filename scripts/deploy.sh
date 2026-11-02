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
: "${NEAR_ACCOUNT_ID:?Set NEAR_ACCOUNT_ID in .env}"
: "${CONTRACT_ID:?Set CONTRACT_ID in .env}"

command -v cargo >/dev/null || { echo "cargo is required" >&2; exit 1; }
command -v near >/dev/null || { echo "near CLI is required" >&2; exit 1; }

echo "Building the Clavis contract..."
cargo build \
  --manifest-path "$ROOT_DIR/contract/Cargo.toml" \
  --target wasm32-unknown-unknown \
  --release

WASM_PATH="$ROOT_DIR/contract/target/wasm32-unknown-unknown/release/clavis_contract.wasm"
[[ -f "$WASM_PATH" ]] || { echo "Contract artifact was not produced" >&2; exit 1; }

INIT_ARGS=$(node -e 'process.stdout.write(JSON.stringify({owner: process.env.OWNER_ID, agent: process.env.NEAR_ACCOUNT_ID, daily_limit: "100000000000000000000000000", per_payment_limit: "20000000000000000000000000"}))')

echo "Deploying to $CONTRACT_ID on testnet..."
near contract deploy "$CONTRACT_ID" \
  use-file "$WASM_PATH" \
  with-init-call new json-args "$INIT_ARGS" \
  prepaid-gas "100 TeraGas" \
  attached-deposit "0 NEAR" \
  network-config testnet \
  sign-with-legacy-keychain \
  send

echo "Contract deployed and initialized: $CONTRACT_ID"
