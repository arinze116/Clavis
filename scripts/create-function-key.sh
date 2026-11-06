#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

: "${NEAR_ACCOUNT_ID:?Set NEAR_ACCOUNT_ID in .env}"
: "${CONTRACT_ID:?Set CONTRACT_ID in .env}"

echo "Creating a request_payment-only key for $CONTRACT_ID on $NEAR_ACCOUNT_ID."
echo "Store the printed private key in agent/config/agent-credentials.local.json under this contract ID, then chmod 600 that file."
echo "Run this command once per payroll contract. Never paste the private key into Git, CI logs, or browser code."
near account add-key "$NEAR_ACCOUNT_ID" \
  grant-function-call-access \
  --allowance "0.25 NEAR" \
  --contract-account-id "$CONTRACT_ID" \
  --function-names request_payment \
  autogenerate-new-keypair \
  print-to-terminal \
  network-config testnet \
  sign-with-legacy-keychain \
  send
