#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACT_DIR="$ROOT_DIR/contract"
RES_DIR="$CONTRACT_DIR/res"
TARGET_DIR="$CONTRACT_DIR/target/wasm32-unknown-unknown/release"

mkdir -p "$RES_DIR"

cargo build \
  --manifest-path "$CONTRACT_DIR/Cargo.toml" \
  --package clavis-contract \
  --target wasm32-unknown-unknown \
  --release
cp "$TARGET_DIR/clavis_contract.wasm" "$RES_DIR/clavis_contract.wasm"

cargo build \
  --manifest-path "$CONTRACT_DIR/Cargo.toml" \
  --package clavis-factory \
  --target wasm32-unknown-unknown \
  --release
cp "$TARGET_DIR/clavis_factory.wasm" "$RES_DIR/clavis_factory.wasm"

echo "Built payroll and factory WASM artifacts in $RES_DIR"
