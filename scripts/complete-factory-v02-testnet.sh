#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly BASELINE_DIRECTORY="${CLAVIS_BASELINE_DIRECTORY:-/home/ubuntu/.local/state/clavis-v02-20261110-factory-final}"

[[ "${CLAVIS_NEAR_KEYRING_ACTIVE:-}" == "1" ]] || {
  echo "Run this workflow through scripts/run-with-clavis-near-keyring.sh." >&2
  exit 2
}
[[ -f "$BASELINE_DIRECTORY/baseline.json" ]] || {
  echo "The private factory rollback baseline is missing: $BASELINE_DIRECTORY/baseline.json" >&2
  exit 2
}

export CLAVIS_BASELINE_DIRECTORY="$BASELINE_DIRECTORY"
export NEAR_RPC_URL="${NEAR_RPC_URL:-https://near-testnet.drpc.org}"
export CLAVIS_NEAR_NETWORK_CONNECTION="${CLAVIS_NEAR_NETWORK_CONNECTION:-testnet-drpc}"

node --import tsx "$ROOT_DIR/scripts/factory-v02-testnet-acceptance.ts" preflight
bash "$ROOT_DIR/scripts/deploy-v02-testnet.sh" factory
node --import tsx "$ROOT_DIR/scripts/factory-v02-testnet-acceptance.ts" acceptance

echo "Factory v0.2 upgrade and dedicated child acceptance completed on NEAR Testnet."
