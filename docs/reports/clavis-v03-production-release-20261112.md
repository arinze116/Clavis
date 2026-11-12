# Clavis v0.3 production release evidence

Date: 2026-11-12  
Network: NEAR Testnet only  
Status: Corrective frontend release in progress

## Source and CI

The v0.3 production-readiness change merged through [pull request #24](https://github.com/arinze116/Clavis/pull/24) as commit `2d3793b6a9a812b3d14c3d55267cfa32987b7018`.

- [CI run 43246974427](https://github.com/arinze116/Clavis/actions/runs/43246974427): passed.
- [Security evidence run 43246974348](https://github.com/arinze116/Clavis/actions/runs/43246974348): passed.
- Vercel deployment `dpl_8UbYjFfeXjzkht5Pmn3XEd5QmFMT` was built from commit `2d3793b`.

Post-deployment browser verification found that the configured `https://rpc.testnet.fastnear.com` endpoint was omitted from the frontend Testnet allowlist. The serverless RPC boundary remained healthy, but the browser failed before rendering. The corrective release adds the exact endpoint, rejects unrecognized and Mainnet RPC configuration at both browser and proxy boundaries, and adds regression tests. This report will be finalized with the corrective merged commit and production-browser evidence after that deployment completes.

## Contract deployment

The reviewed v0.3 artifacts were built immediately before deployment:

| Artifact | SHA-256 | Deployed code hash |
| --- | --- | --- |
| Payroll root | `f0a8d876e4d4e6cd118fe7058fff56641266a8f5e2fd1264a46bc1a003d6fd3b` | `HCSBAq5cUe4g4vLMEq9CjxsJ4BZKteCvu5beaSVM5yAr` |
| Factory | `04949da689665eb49426562a3953062d97337a9f843eaf5d0fa851b237f907fc` | `Jt4ufDCh8YFythVpRx2MSSh6zr6eX4N2zjZDnqyZiZy` |

| Target | Final transaction | Result |
| --- | --- | --- |
| `clavis.testnet` | [`BrhdaCBXiYCMEAwtBRPQoCr7bDbFc645sEMGa64zFfPY`](https://testnet.nearblocks.io/txns/BrhdaCBXiYCMEAwtBRPQoCr7bDbFc645sEMGa64zFfPY) | Final success; `contract_version` returns `0.3.0` |
| `factory.clavis.testnet` | [`C4TRcKwXwwQmBpfGrbXgMgGrDF2AKh2ZZ99JNpufnEKP`](https://testnet.nearblocks.io/txns/C4TRcKwXwwQmBpfGrbXgMgGrDF2AKh2ZZ99JNpufnEKP) | Final success; `contract_version` returns `0.3.0` |

The guarded deployment compared owner, agent, limits, spend, pause state, recipients, audit entries, anomalies, pending settlement state, factory root account, and factory registry before and after deployment. The comparison passed. No pending native settlement existed before or after migration.

The root Full Access deployment key and factory Full Access deployment key remained unchanged. The factory registry retained all three existing entries.

## Backend agent

The agent was deployed from commit `2d3793b6a9a812b3d14c3d55267cfa32987b7018` after the root and factory independently reported v0.3.0.

- PM2 service: `clavis-agent`, online, package version `0.3.0`.
- Health endpoint: `{"ok":true}`.
- Credential and payroll files: metadata and SHA-256 preservation checks passed before and after deployment.
- Signer account: `clavis-agent.testnet`.
- Signer permission: one Function Call key restricted to `request_payment` on `clavis.testnet`.

The agent will be redeployed from the final corrective merge commit so deployed source identity remains exact even though the corrective changes are frontend/configuration-only.

## Verification

`bash scripts/verify.sh` passed after the corrective changes and generated evidence refresh:

- 34 payroll-contract tests;
- 3 factory tests;
- 12 signer tests;
- 73 agent tests;
- 54 API tests;
- 8 Playwright tests;
- 184 total mapped repository tests;
- 31 mapped security threats;
- Rust formatting and Clippy;
- TypeScript and Testnet-script type checks;
- payroll and factory WASM builds;
- frontend and agent production builds;
- generated security-evidence freshness;
- deployment-script syntax;
- dependency audit threshold;
- Git whitespace checks.

The dependency audit reports 17 low-severity transitive `elliptic` advisories in the NEAR wallet stack. The offered automated remediation is a breaking dependency change and was not applied without compatibility work.

## Remaining release checks

- Merge the corrective frontend PR after CI passes.
- Confirm Vercel built the exact corrective merge commit.
- Redeploy the agent from that exact commit.
- Run live route, console, accessibility, and responsive checks at 1440, 768, and 390 pixels.
- Confirm final contract state, agent health, and production logs again.
- Replace this in-progress status with the final production verdict.

## Persistent limitations

- Testnet only; no Mainnet deployment.
- Native NEAR is the only executable settlement route; cross-chain and split execution fail closed.
- Stale callback recovery relies on owner interpretation of a final receipt.
- Notification delivery is at least once and can duplicate after a narrow crash window.
- Legacy v0.1 factory children do not have an in-place owner upgrade path.
- Interrupted factory deployment cannot be safely auto-refunded without trustworthy receipt interpretation.
- Large wallet/RPC chunks and vendor `eval` warnings remain maintenance items.
- No independent third-party security audit has been completed.
