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
RPC_URL="${NEAR_RPC_URL:-https://test.rpc.fastnear.com}"

[[ "${CLAVIS_NEAR_KEYRING_ACTIVE:-}" == "1" ]] || {
  echo "Run this script through scripts/run-with-clavis-near-keyring.sh." >&2
  exit 2
}
[[ "$OWNER_ID" == *.testnet && "$NEAR_ACCOUNT_ID" == *.testnet && "$CONTRACT_ID" == *.testnet ]] || {
  echo "All deployment identities must be .testnet accounts." >&2
  exit 2
}
case "${RPC_URL%/}" in
  https://test.rpc.fastnear.com | https://near-testnet.drpc.org | https://testnet-rpc.intea.rs | https://archival-rpc.testnet.near.org) ;;
  *) echo "Refusing unrecognised Testnet RPC endpoint: $RPC_URL" >&2; exit 2 ;;
esac

command -v cargo >/dev/null || { echo "cargo is required" >&2; exit 1; }
command -v near >/dev/null || { echo "near CLI is required" >&2; exit 1; }

echo "Building the Clavis contract..."
cargo build \
  --manifest-path "$ROOT_DIR/contract/Cargo.toml" \
  --target wasm32-unknown-unknown \
  --release

WASM_PATH="$ROOT_DIR/contract/target/wasm32-unknown-unknown/release/clavis_contract.wasm"
[[ -f "$WASM_PATH" ]] || { echo "Contract artifact was not produced" >&2; exit 1; }

CODE_HASH="$(
  node -e '
    const account = process.argv[1];
    const rpc = process.argv[2];
    const body = {jsonrpc:"2.0",id:"fresh-contract-check",method:"query",params:{request_type:"view_account",finality:"final",account_id:account}};
    fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then(async (response)=>{
        if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
        const value = await response.json();
        if (!value.result?.code_hash) throw new Error(value.error?.message ?? "Account lookup failed");
        process.stdout.write(value.result.code_hash);
      })
      .catch((error)=>{ console.error(error.message); process.exit(1); });
  ' "$CONTRACT_ID" "$RPC_URL"
)"
[[ "$CODE_HASH" == "11111111111111111111111111111111" ]] || {
  echo "Refusing fresh initialization: $CONTRACT_ID already has deployed code. Use the reviewed migration workflow instead." >&2
  exit 1
}

INIT_ARGS=$(node -e 'process.stdout.write(JSON.stringify({owner: process.env.OWNER_ID, agent: process.env.NEAR_ACCOUNT_ID, daily_limit: "100000000000000000000000000", per_payment_limit: "20000000000000000000000000"}))')

echo "Deploying and initializing the empty account $CONTRACT_ID on testnet..."
near contract deploy "$CONTRACT_ID" \
  use-file "$WASM_PATH" \
  with-init-call new json-args "$INIT_ARGS" \
  prepaid-gas "100 TeraGas" \
  attached-deposit "0 NEAR" \
  network-config testnet \
  sign-with-keychain \
  send

echo "Contract deployed and initialized: $CONTRACT_ID"
