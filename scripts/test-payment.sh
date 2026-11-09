#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT_DIR/agent/.env" ]] || { echo "Copy .env.example to agent/.env and add the restricted key" >&2; exit 1; }
[[ -f "$ROOT_DIR/agent/config/payroll.local.json" ]] || { echo "Run ./scripts/setup.sh first" >&2; exit 1; }

echo "Running one payroll cycle. Only contract-controlled native NEAR can execute; cross-chain routes fail closed."
cd "$ROOT_DIR/agent"
RUN_ONCE=true npm start
