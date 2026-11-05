#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ACCOUNT="${ROOT_ACCOUNT:-clavis.testnet}"
FACTORY_ACCOUNT="${FACTORY_CONTRACT_ID:-factory.clavis.testnet}"
FACTORY_INITIAL_BALANCE="${FACTORY_INITIAL_BALANCE:-8 NEAR}"
RPC_URL="${NEAR_RPC_URL:-https://rpc.testnet.fastnear.com}"

command -v near >/dev/null || { echo "near CLI is required" >&2; exit 1; }

"$ROOT_DIR/scripts/build-contracts.sh"

echo "Upgrading the root provisioner on $ROOT_ACCOUNT..."
near contract deploy "$ROOT_ACCOUNT" \
  use-file "$ROOT_DIR/contract/res/clavis_contract.wasm" \
  without-init-call \
  network-config testnet \
  sign-with-legacy-keychain \
  send

FACTORY_EXISTS="$(
  node -e '
    const account = process.argv[1];
    const body = {jsonrpc:"2.0",id:"factory-check",method:"query",params:{request_type:"view_account",finality:"final",account_id:account}};
    fetch(process.argv[2],{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then((response)=>response.json())
      .then((value)=>process.stdout.write(value.result ? "yes" : "no"))
      .catch(()=>process.stdout.write("no"));
  ' "$FACTORY_ACCOUNT" "$RPC_URL"
)"

if [[ "$FACTORY_EXISTS" != "yes" ]]; then
  echo "Creating $FACTORY_ACCOUNT with $FACTORY_INITIAL_BALANCE..."
  near account create-account fund-myself "$FACTORY_ACCOUNT" "$FACTORY_INITIAL_BALANCE" \
    autogenerate-new-keypair save-to-legacy-keychain \
    sign-as "$ROOT_ACCOUNT" \
    network-config testnet \
    sign-with-legacy-keychain \
    send

  INIT_ARGS="$(node -e 'process.stdout.write(JSON.stringify({root_account: process.argv[1]}))' "$ROOT_ACCOUNT")"
  near contract deploy "$FACTORY_ACCOUNT" \
    use-file "$ROOT_DIR/contract/res/clavis_factory.wasm" \
    with-init-call new json-args "$INIT_ARGS" \
    prepaid-gas "100 TeraGas" \
    attached-deposit "0 NEAR" \
    network-config testnet \
    sign-with-legacy-keychain \
    send
else
  echo "Upgrading existing factory contract..."
  near contract deploy "$FACTORY_ACCOUNT" \
    use-file "$ROOT_DIR/contract/res/clavis_factory.wasm" \
    without-init-call \
    network-config testnet \
    sign-with-legacy-keychain \
    send
fi

echo "Factory ready: $FACTORY_ACCOUNT"
