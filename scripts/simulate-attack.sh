#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT_DIR/agent/.env" ]] || { echo "Copy .env.example to agent/.env and add the restricted key" >&2; exit 1; }

echo "Using the restricted agent key to request an unapproved recipient..."
cd "$ROOT_DIR/agent"
npm run simulate-attack
echo "The expected result is: Recipient not approved. Treasury policy remains unchanged."
