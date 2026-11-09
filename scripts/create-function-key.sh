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

[[ "${CLAVIS_NEAR_KEYRING_ACTIVE:-}" == "1" ]] || {
  echo "Run this script through scripts/run-with-clavis-near-keyring.sh." >&2
  exit 2
}
[[ "$NEAR_ACCOUNT_ID" == *.testnet && "$CONTRACT_ID" == *.testnet ]] || {
  echo "Agent and contract identities must be .testnet accounts." >&2
  exit 2
}

echo "Creating a request_payment-only key for $CONTRACT_ID on $NEAR_ACCOUNT_ID."
echo "The generated key remains in the isolated OS keychain and is never printed."
echo "This interactive key is not a replacement for the protected backend credential file."
near account add-key "$NEAR_ACCOUNT_ID" \
  grant-function-call-access \
  --allowance "0.25 NEAR" \
  --contract-account-id "$CONTRACT_ID" \
  --function-names request_payment \
  autogenerate-new-keypair \
  save-to-keychain \
  network-config testnet \
  sign-with-keychain \
  send
