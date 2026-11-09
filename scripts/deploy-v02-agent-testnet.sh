#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DEPLOY_DIR="/opt/clavis"
readonly RPC_URL="${NEAR_RPC_URL:-https://rpc.testnet.near.org}"
readonly CONTRACT_ID="clavis.testnet"
readonly FACTORY_ID="factory.clavis.testnet"
readonly CREDENTIAL_PATH="$DEPLOY_DIR/agent/config/agent-credentials.local.json"
readonly PAYROLL_PATH="$DEPLOY_DIR/agent/config/payroll.local.json"
readonly EVIDENCE_DIRECTORY="${CLAVIS_BASELINE_DIRECTORY:-/home/ubuntu/.local/state/clavis-v02-20261109}/execution"
readonly PHASE="${1:-all}"

case "$PHASE" in
  all | prepare | run-once | start | status) ;;
  *)
    echo "Usage: bash scripts/deploy-v02-agent-testnet.sh [all|prepare|run-once|start|status]" >&2
    exit 2
    ;;
esac
for account_id in "$CONTRACT_ID" "$FACTORY_ID"; do
  [[ "$account_id" == *.testnet ]] || { echo "Refusing non-Testnet account: $account_id" >&2; exit 2; }
done
case "${RPC_URL%/}" in
  https://rpc.testnet.near.org | https://rpc.testnet.fastnear.com | https://archival-rpc.testnet.fastnear.com) ;;
  *) echo "Refusing unrecognised Testnet RPC endpoint: $RPC_URL" >&2; exit 2 ;;
esac
[[ -d "$DEPLOY_DIR/.git" ]] || { echo "Clavis deployment checkout is missing." >&2; exit 2; }
[[ -f "$CREDENTIAL_PATH" ]] || { echo "Backend agent credential is missing." >&2; exit 2; }
mkdir -p "$EVIDENCE_DIRECTORY"
chmod 0700 "$EVIDENCE_DIRECTORY"

credential_state() {
  stat -c '%i:%s:%Y:%a' "$CREDENTIAL_PATH"
  sha256sum "$CREDENTIAL_PATH" | awk '{print $1}'
}

readonly BEFORE_CREDENTIAL_STATE="$(credential_state)"

verify_credential_preserved() {
  if [[ "$(credential_state)" != "$BEFORE_CREDENTIAL_STATE" ]]; then
    echo "Safety check failed: backend agent credential changed." >&2
    exit 1
  fi
}
trap verify_credential_preserved EXIT

rpc_view() {
  local account_id="$1"
  local method_name="$2"
  node - "$RPC_URL" "$account_id" "$method_name" <<'NODE'
const [rpcUrl, accountId, methodName] = process.argv.slice(2);
const statusResponse = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-agent-network", method: "status", params: [] }),
  signal: AbortSignal.timeout(20_000),
});
const status = await statusResponse.json();
if (status.result?.chain_id !== "testnet") throw new Error(`Refusing chain ${status.result?.chain_id ?? "unknown"}`);
const response = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "clavis-agent-view",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: accountId,
      method_name: methodName,
      args_base64: "e30=",
    },
  }),
  signal: AbortSignal.timeout(20_000),
});
const body = await response.json();
if (!body.result?.result) throw new Error(body.error?.message ?? `${methodName} failed`);
process.stdout.write(Buffer.from(body.result.result).toString("utf8"));
NODE
}

verify_root_version() {
  [[ "$(rpc_view "$CONTRACT_ID" contract_version)" == '"0.2.0"' ]] || {
    echo "The v0.2 agent will not start until $CONTRACT_ID reports v0.2.0." >&2
    exit 1
  }
}

write_payroll_plan() {
  local temporary_path
  temporary_path="$(mktemp "$DEPLOY_DIR/agent/config/payroll.local.json.XXXXXX")"
  node --input-type=module - "$temporary_path" <<'NODE'
import { writeFile } from "node:fs/promises";
const outputPath = process.argv[2];
const payroll = {
  businesses: [
    {
      contract_id: "clavis.testnet",
      owner_email: "notifications-disabled@example.com",
      recipients: [
        {
          recipientHash: "08ef5e4511a129f31e1ebb73e6b45181c8d335b73af63fdaac9fb63d55c349b6",
          name: "Arinze Worker 1",
          nearAddress: "arinze-worker1.testnet",
          amountYocto: "10000000000000000000000",
          milestoneReady: false,
          destinations: [
            {
              chain: "near",
              token: "NEAR",
              address: "arinze-worker1.testnet",
              percentage: 100,
            },
          ],
        },
        {
          recipientHash: "588e9a3baf6c8287cd594e9370602f4b070d3f6433a6ab55aa9889dc7a84b2ed",
          name: "Arinze Worker 2",
          nearAddress: "arinze-worker2.testnet",
          amountYocto: "10000000000000000000000",
          milestoneReady: false,
          destinations: [
            {
              chain: "near",
              token: "NEAR",
              address: "arinze-worker2.testnet",
              percentage: 100,
            },
          ],
        },
      ],
    },
  ],
};
await writeFile(outputPath, `${JSON.stringify(payroll, null, 2)}\n`, { mode: 0o600 });
NODE
  chmod 0600 "$temporary_path"
  (
    cd "$DEPLOY_DIR"
    PAYROLL_CONFIG_PATH="$temporary_path" \
      node --import tsx -e \
      'import("./agent/src/payroll.ts").then(({loadPayrollCatalog})=>loadPayrollCatalog(process.env.PAYROLL_CONFIG_PATH)).catch((error)=>{console.error(error.message);process.exit(1)})'
  )
  mv -f "$temporary_path" "$PAYROLL_PATH"
  chmod 0600 "$PAYROLL_PATH"
}

prepare() {
  verify_root_version
  pm2 stop clavis-agent >/dev/null
  git -C "$DEPLOY_DIR" fetch origin main
  git -C "$DEPLOY_DIR" checkout main
  git -C "$DEPLOY_DIR" pull --ff-only origin main
  npm ci --prefix "$DEPLOY_DIR"
  npm run typecheck --prefix "$DEPLOY_DIR"
  npm run build --prefix "$DEPLOY_DIR"
  write_payroll_plan
  verify_credential_preserved
  git -C "$DEPLOY_DIR" rev-parse HEAD | tee "$EVIDENCE_DIRECTORY/agent-source-head.txt"
  chmod 0600 "$EVIDENCE_DIRECTORY/agent-source-head.txt"
}

run_once() {
  verify_root_version
  [[ -f "$PAYROLL_PATH" ]] || { echo "Private payroll plan is missing." >&2; exit 1; }
  if [[ "$(pm2 pid clavis-agent | tr -d '[:space:]')" != "0" ]]; then
    pm2 stop clavis-agent >/dev/null
  fi
  (
    cd "$DEPLOY_DIR"
    RUN_ONCE=true \
      NOTIFICATION_API_ENABLED=false \
      RESEND_API_KEY= \
      TELEGRAM_BOT_TOKEN= \
      TELEGRAM_CHAT_ID= \
      node --import tsx agent/src/index.ts
  ) 2>&1 | tee "$EVIDENCE_DIRECTORY/agent-run-once.log"
  chmod 0600 "$EVIDENCE_DIRECTORY/agent-run-once.log"
  rg -q '"event":"payment.approved"|payment.approved' "$EVIDENCE_DIRECTORY/agent-run-once.log" || {
    echo "The one-shot scheduler did not record an approved payment." >&2
    exit 1
  }
}

start_agent() {
  verify_root_version
  pm2 restart clavis-agent --update-env
  pm2 save >/dev/null
  for _ in $(seq 1 15); do
    if [[ "$(pm2 pid clavis-agent | tr -d '[:space:]')" != "0" ]] \
      && curl --fail --silent --show-error http://127.0.0.1:8787/health >/dev/null; then
      pm2 status clavis-agent
      pm2 logs clavis-agent --lines 30 --nostream | tee "$EVIDENCE_DIRECTORY/agent-health.log"
      chmod 0600 "$EVIDENCE_DIRECTORY/agent-health.log"
      return
    fi
    sleep 1
  done
  echo "clavis-agent did not become healthy." >&2
  pm2 logs clavis-agent --lines 60 --nostream >&2
  exit 1
}

status_agent() {
  verify_root_version
  pm2 status clavis-agent
  curl --fail --silent --show-error http://127.0.0.1:8787/health
  echo
}

case "$PHASE" in
  all)
    prepare
    run_once
    start_agent
    ;;
  prepare) prepare ;;
  run-once) run_once ;;
  start) start_agent ;;
  status) status_agent ;;
esac

verify_credential_preserved
trap - EXIT
echo "Completed v0.2 agent phase: $PHASE"
