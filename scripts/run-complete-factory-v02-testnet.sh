#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

exec bash "$ROOT_DIR/scripts/run-with-clavis-near-keyring.sh" \
  bash "$ROOT_DIR/scripts/complete-factory-v02-testnet.sh"
