#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cargo test --manifest-path contract/Cargo.toml
"$ROOT_DIR/scripts/build-contracts.sh"
cargo test --manifest-path contract/Cargo.toml --package clavis-factory
npm run typecheck
npm run test:agent
npm run build
echo "Clavis verification complete."
