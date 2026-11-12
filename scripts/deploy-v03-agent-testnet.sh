#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077

readonly DEPLOY_DIR="/opt/clavis"
readonly RPC_URL="${NEAR_RPC_URL:-https://test.rpc.fastnear.com}"
readonly EXPECTED_COMMIT="${CLAVIS_EXPECTED_COMMIT:-}"
readonly CREDENTIAL_PATH="$DEPLOY_DIR/agent/config/agent-credentials.local.json"
readonly PAYROLL_PATH="$DEPLOY_DIR/agent/config/payroll.local.json"
readonly EVIDENCE_DIRECTORY="${CLAVIS_V03_EVIDENCE_DIRECTORY:-/home/ubuntu/.local/state/clavis-v03-20261112}"

[[ -n "$EXPECTED_COMMIT" ]] || {
  echo "Set CLAVIS_EXPECTED_COMMIT to the merged default-branch SHA." >&2
  exit 2
}
[[ -d "$DEPLOY_DIR/.git" ]] || { echo "Clavis deployment checkout is missing." >&2; exit 2; }
[[ -f "$CREDENTIAL_PATH" && -f "$PAYROLL_PATH" ]] || {
  echo "Production agent credentials or payroll plan are missing." >&2
  exit 2
}
case "${RPC_URL%/}" in
  https://test.rpc.fastnear.com | https://near-testnet.drpc.org | https://testnet-rpc.intea.rs | https://archival-rpc.testnet.near.org) ;;
  *) echo "Refusing unrecognised Testnet RPC endpoint: $RPC_URL" >&2; exit 2 ;;
esac

mkdir -p "$EVIDENCE_DIRECTORY"
chmod 0700 "$EVIDENCE_DIRECTORY"

protected_state() {
  stat -c '%n:%i:%s:%Y:%a' "$CREDENTIAL_PATH" "$PAYROLL_PATH"
  sha256sum "$CREDENTIAL_PATH" "$PAYROLL_PATH"
}

readonly BEFORE_PROTECTED_STATE="$(protected_state)"
verify_protected_state() {
  if [[ "$(protected_state)" != "$BEFORE_PROTECTED_STATE" ]]; then
    echo "Safety check failed: protected agent configuration changed." >&2
    exit 1
  fi
}
trap verify_protected_state EXIT

node - "$RPC_URL" <<'NODE'
const rpcUrl = process.argv[2];
async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-agent-deploy", method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();
  if (body.error || body.result === undefined) throw new Error(body.error?.message ?? "RPC failure");
  return body.result;
}
const status = await rpc("status", []);
if (status.chain_id !== "testnet") throw new Error(`Refusing chain ${status.chain_id ?? "unknown"}`);
for (const accountId of ["clavis.testnet", "factory.clavis.testnet"]) {
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: "contract_version",
    args_base64: "e30=",
  });
  const version = JSON.parse(Buffer.from(result.result).toString("utf8"));
  if (version !== "0.3.0") throw new Error(`${accountId} reports ${version}, expected 0.3.0`);
}
console.log("Verified Testnet v0.3 root and factory before agent deployment.");
NODE

git -C "$DEPLOY_DIR" fetch origin main
git -C "$DEPLOY_DIR" checkout main
git -C "$DEPLOY_DIR" pull --ff-only origin main
readonly DEPLOYED_COMMIT="$(git -C "$DEPLOY_DIR" rev-parse HEAD)"
[[ "$DEPLOYED_COMMIT" == "$EXPECTED_COMMIT" ]] || {
  echo "Deployment checkout $DEPLOYED_COMMIT does not match expected $EXPECTED_COMMIT." >&2
  exit 1
}

npm ci --prefix "$DEPLOY_DIR"
npm run typecheck --prefix "$DEPLOY_DIR"
npm run test:agent --prefix "$DEPLOY_DIR"
npm run build --prefix "$DEPLOY_DIR"
verify_protected_state

pm2 startOrRestart "$DEPLOY_DIR/ecosystem.config.cjs" --only clavis-agent --update-env
pm2 save >/dev/null
for _ in $(seq 1 20); do
  if [[ "$(pm2 pid clavis-agent | tr -d '[:space:]')" != "0" ]] \
    && curl --fail --silent --show-error http://127.0.0.1:8787/health >/dev/null; then
    break
  fi
  sleep 1
done
curl --fail --silent --show-error http://127.0.0.1:8787/health \
  | tee "$EVIDENCE_DIRECTORY/agent-health.json"
echo
pm2 describe clavis-agent | tee "$EVIDENCE_DIRECTORY/agent-pm2.txt" >/dev/null
printf '%s\n' "$DEPLOYED_COMMIT" > "$EVIDENCE_DIRECTORY/agent-source-head.txt"
chmod 0600 "$EVIDENCE_DIRECTORY/agent-health.json" "$EVIDENCE_DIRECTORY/agent-pm2.txt" "$EVIDENCE_DIRECTORY/agent-source-head.txt"

verify_protected_state
trap - EXIT
echo "Deployed and verified Clavis agent commit $DEPLOYED_COMMIT."
