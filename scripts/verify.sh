#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cargo test --manifest-path contract/Cargo.toml
npm run typecheck
npm run test:agent
npm run build
cargo build --manifest-path contract/Cargo.toml --target wasm32-unknown-unknown --release

echo "Clavis verification complete."
