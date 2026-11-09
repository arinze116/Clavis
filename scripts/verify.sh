#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cargo fmt --check --manifest-path contract/Cargo.toml
cargo test --manifest-path contract/Cargo.toml
"$ROOT_DIR/scripts/build-contracts.sh"
cargo test --manifest-path contract/Cargo.toml --package clavis-factory
cargo fmt --check --manifest-path tools/clavis-near-signer/Cargo.toml
cargo clippy --locked --manifest-path tools/clavis-near-signer/Cargo.toml -- -D warnings
cargo test --locked --manifest-path tools/clavis-near-signer/Cargo.toml
cargo build --locked --release --manifest-path tools/clavis-near-signer/Cargo.toml
npm run typecheck
npm run testnet:typecheck
npm run test:api
npm run test:agent
npm run build
npm run demo:typecheck
npm run test:e2e:built
mkdir -p artifacts/security-evidence
npm exec --workspace=@clavis/agent -- vitest run \
  --reporter=json \
  --outputFile=../artifacts/security-evidence/vitest.json
node scripts/security/generate-security-report.mjs \
  --check \
  --vitest-report artifacts/security-evidence/vitest.json \
  --frontend-output frontend/src/data/securityEvidence.generated.ts
npm audit --omit=dev --audit-level=moderate
bash -n \
  scripts/connect-near-signers.sh \
  scripts/run-with-clavis-near-keyring.sh \
  scripts/deploy-v02-testnet.sh \
  scripts/configure-v02-payroll-testnet.sh \
  scripts/deploy-v02-agent-testnet.sh \
  scripts/execute-v02-testnet.sh
git diff --check
echo "Clavis verification complete."
