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

echo "Creating a restricted key. Store the printed private key in agent/.env once."
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
