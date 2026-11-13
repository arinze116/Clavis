# Clavis v0.3 production release evidence

Date: 2026-11-12  
Network: NEAR Testnet only  
Status: **COMPLETE — AUDITED, FIXED, MERGED, DEPLOYED AND VERIFIED**

## Source, pull requests, and CI

The production-readiness release merged through three protected pull requests:

| Pull request | Merge commit | Purpose |
| --- | --- | --- |
| [#24](https://github.com/arinze116/Clavis/pull/24) | `2d3793b6a9a812b3d14c3d55267cfa32987b7018` | v0.3 contract, agent, security, test, and documentation remediation |
| [#25](https://github.com/arinze116/Clavis/pull/25) | `b85b5fc674886c4e4ab519939072b28f45afbec3` | Testnet RPC configuration correction and initial live-deployment evidence |
| [#26](https://github.com/arinze116/Clavis/pull/26) | `0fd129610f2729cb0f56f31a10adbef18fa027ca` | Resilient Testnet RPC defaults and failover for browser, API, agent reads, and signed transactions |

Required checks passed on pull request #26:

- [CI run 43256308621](https://github.com/arinze116/Clavis/actions/runs/43256308621): `verify` and `browser-smoke` passed.
- [Security evidence run 43256308735](https://github.com/arinze116/Clavis/actions/runs/43256308735): passed.
- Both Vercel preview projects passed.

Exact-main checks also passed for merge commit `0fd1296`:

- [CI run 43256863190](https://github.com/arinze116/Clavis/actions/runs/43256863190): passed.
- [Security evidence run 43256863186](https://github.com/arinze116/Clavis/actions/runs/43256863186): passed.

No required check was bypassed.

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

The guarded deployment compared owner, agent, limits, spend, pause state, recipients, audit entries, anomalies, pending settlement state, factory root account, and factory registry before and after deployment. The comparison passed. The root and factory Full Access deployment keys remained unchanged.

Final read-only RPC verification at `2026-11-12T16:22:45Z` confirmed:

- chain ID `testnet`;
- root owner `clavis.testnet` and agent `clavis-agent.testnet`;
- five root recipients and no pending native settlement recovery;
- factory root account `clavis.testnet` and three registered child contracts;
- unchanged root and factory code hashes shown above.

## RPC resilience remediation

Production monitoring found repeated FastNEAR HTTP 429 responses. The protected VPS configuration was moved to `https://near-testnet.drpc.org`, and source now uses dRPC by default.

The merged implementation adds an explicit Testnet-only failover set for:

- agent view calls;
- agent signed transactions through `FailoverRpcProvider`;
- the same-origin frontend RPC boundary;
- historical transaction lookups;
- AI route observations.

Unrecognized and Mainnet RPC overrides are ignored or rejected. dRPC, Intea, and the NEAR archival endpoint independently returned `chain_id: testnet` during release verification.

## Backend agent

The code-bearing agent release fast-forwarded `/opt/clavis` to merge commit `0fd129610f2729cb0f56f31a10adbef18fa027ca`, then independently ran type checks, 75 agent tests, and production builds before restarting PM2. The same guarded process redeployed the final documentation-only default-branch merge; the protected `agent-source-head.txt` evidence matched the current `origin/main` SHA at acceptance.

- PM2 service: `clavis-agent`, online, package version `0.3.0`.
- Health endpoint: `{"ok":true}`.
- Credential and private-payroll files: metadata and SHA-256 preservation checks passed.
- Signer account: `clavis-agent.testnet`.
- Signer permission: one Function Call key restricted to `request_payment` on `clavis.testnet`.
- Scheduler: multiple complete 60-second cycles succeeded after restart with five root recipients.
- Logs: no new RPC failures or HTTP 429 responses; only expected `payroll.plan_missing` warnings for registered factory children without local private plans.

## Production frontend

Production URL: <https://clavisapp.vercel.app>

Both Vercel projects reported successful code-bearing deployments for exact merge commit `0fd1296`:

- [Clavis deployment status](https://vercel.com/0xmaxizs-projects/clavis/746NAmzodcU9aRjkwrXbytUeFVcz)
- [Clavis frontend deployment status](https://vercel.com/0xmaxizs-projects/clavis-frontend/HB4TM8EPuosks4Rh7vktz93nqzjK)

Both projects also passed the final documentation-only default-branch deployment. A fresh production smoke test covered all nine public routes, and the same-origin NEAR RPC boundary returned a final Testnet block.

Post-deployment browser verification captured 27 route/viewport combinations: nine public routes at 1440×1100, 768×1024, and 390×844. Every case returned HTTP 200 with:

- zero console or page errors;
- exactly one visible page heading and one `main` landmark;
- no horizontal overflow;
- no detected unlabeled visible controls.

Evidence: `artifacts/acceptance/clavis-v03-20261112/production-routes/`.

The setup workflow also passed focused accessibility and responsive checks at widths 320, 375, 768, 1024, and 1440 pixels, including skip-link focus, minimum 44×44 pixel targets, image alternatives, semantic landmarks, and overflow checks.

Evidence: `artifacts/acceptance/clavis-v03-20261112/live-factory-production/`.

## Verification

`bash scripts/verify.sh` passed on the final source:

- 34 payroll-contract tests;
- 3 factory tests;
- 12 signer tests;
- 75 agent tests;
- 55 API tests;
- 8 Playwright tests;
- 187 total mapped repository tests;
- 31 mapped security threats;
- Rust formatting and Clippy;
- TypeScript and Testnet-script type checks;
- payroll and factory WASM builds;
- frontend and agent production builds;
- generated security-evidence freshness;
- deployment-script syntax;
- dependency audit threshold;
- Git whitespace checks.

The dependency audit reports 17 low-severity transitive `elliptic` advisories in the NEAR wallet stack. The offered automated remediation is a breaking dependency change and was not applied without compatibility work. A clean production `npm ci` reported 22 low-severity findings across all development and runtime packages; the repository release gate enforces the accepted threshold and still reports the 17 runtime-relevant transitive findings above.

## Persistent limitations

- Testnet only; no Mainnet deployment.
- Native NEAR is the only implemented settlement transfer. Cross-chain execution is rejected by the contract, and the production scheduler rejects cross-chain and split plans before submission.
- A later documentation audit found that the contract accepts split policy and does not enforce split percentages for a direct native request. This contract-level gap was not covered by the release tests recorded above.
- Stale callback recovery relies on owner interpretation of a final receipt.
- Notification delivery is at least once and can duplicate after a narrow crash window.
- Legacy v0.1 factory children do not have an in-place owner upgrade path.
- Interrupted factory deployment cannot be safely auto-refunded without trustworthy receipt interpretation.
- Large wallet/RPC chunks and vendor `eval` warnings remain maintenance items.
- No independent third-party security audit has been completed.
