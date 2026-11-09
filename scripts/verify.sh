#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cargo fmt --check --manifest-path contract/Cargo.toml
cargo test --manifest-path contract/Cargo.toml
"$ROOT_DIR/scripts/build-contracts.sh"
cargo test --manifest-path contract/Cargo.toml --package clavis-factory
npm run typecheck
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
git diff --check
echo "Clavis verification complete."
