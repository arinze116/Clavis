#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ACCOUNT="${ROOT_ACCOUNT:-clavis.testnet}"
FACTORY_ACCOUNT="${FACTORY_CONTRACT_ID:-factory.clavis.testnet}"
FACTORY_INITIAL_BALANCE="${FACTORY_INITIAL_BALANCE:-8 NEAR}"
RPC_URL="${NEAR_RPC_URL:-https://rpc.testnet.fastnear.com}"

command -v near >/dev/null || { echo "near CLI is required" >&2; exit 1; }

"$ROOT_DIR/scripts/build-contracts.sh"

ROOT_STATE="$(
  node -e '
    const account = process.argv[1];
    const rpc = process.argv[2];
    async function view(method) {
      const body = {jsonrpc:"2.0",id:`root-${method}`,method:"query",params:{request_type:"call_function",finality:"final",account_id:account,method_name:method,args_base64:"e30="}};
      const response = await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const value = await response.json();
      if (!value.result?.result) throw new Error(value.error?.message ?? `${method} failed`);
      return JSON.parse(Buffer.from(value.result.result).toString("utf8"));
    }
    Promise.all([view("get_owner"), view("contract_version")])
      .then(([owner, version]) => process.stdout.write(JSON.stringify({owner, version})))
      .catch((error) => { console.error(error.message); process.exit(1); });
  ' "$ROOT_ACCOUNT" "$RPC_URL"
)"
ROOT_OWNER="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).owner)' "$ROOT_STATE")"
ROOT_VERSION="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).version)' "$ROOT_STATE")"
[[ "$ROOT_OWNER" == "$ROOT_ACCOUNT" ]] || {
  echo "Refusing root migration: stored owner is $ROOT_OWNER, not deployment signer $ROOT_ACCOUNT" >&2
  exit 1
}
[[ "$ROOT_VERSION" == "0.1.0" ]] || {
  echo "Refusing automatic migration from unexpected root version $ROOT_VERSION; review the account state manually" >&2
  exit 1
}

echo "Upgrading the root provisioner on $ROOT_ACCOUNT..."
near contract deploy "$ROOT_ACCOUNT" \
  use-file "$ROOT_DIR/contract/res/clavis_contract.wasm" \
  with-init-call migrate json-args '{}' \
  prepaid-gas "100 TeraGas" \
  attached-deposit "0 NEAR" \
  network-config testnet \
  sign-with-legacy-keychain \
  send

FACTORY_EXISTS="$(
  node -e '
    const account = process.argv[1];
    const body = {jsonrpc:"2.0",id:"factory-check",method:"query",params:{request_type:"view_account",finality:"final",account_id:account}};
    fetch(process.argv[2],{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then((response)=>response.json())
      .then((value)=>{
        if (value.result) process.stdout.write("yes");
        else if (value.error?.cause?.name === "UNKNOWN_ACCOUNT") process.stdout.write("no");
        else throw new Error(value.error?.message ?? "Factory account lookup failed");
      })
      .catch((error)=>{ console.error(error.message); process.exit(1); });
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
