# Clavis judge-ready build plan

## Verified realtime truth pass (2026-11-07)

| ID | Outcome | Acceptance and verification |
| --- | --- | --- |
| R1 | Coherent live evidence | Contract-backed dashboard, report, anomaly, and security evidence bundles are pinned to one exact NEAR final block; policy is grounded to owner text, route advice uses timestamped multi-network observations, and stale refresh failures are labelled |
| R2 | No model-authored facts | Payroll, security, anomaly, route, and policy facts are deterministically rendered or source-grounded; models choose only bounded codes/candidates |
| R3 | Honest authorization language | Reports distinguish contract authorization from off-chain delivery and never call `last_paid` delivery proof |
| R4 | Newest anomaly coverage | API, dashboard, notification bell, and VPS monitor page from the newest anomaly records instead of permanently reading the oldest 100 |
| R5 | Near-real-time integration | Dashboard, audit, and anomaly bell poll final state every 10 seconds and refresh on focus; documentation explicitly avoids claiming a simulated stream |
| R6 | Verified fallback | Reports, security summaries, anomaly guidance, and route guidance remain evidence-backed when NEAR AI is unavailable; policy extraction fails visibly without a configured key |

Verification: 23 API tests, 54 agent tests, 22 payroll-contract tests, 3 factory tests, full typecheck, both release WASM builds, production build, 5 Playwright proof-path tests, and live read-only smokes against `clavis.testnet` for report, anomaly, route, and security evidence.

## Judge-evidence hardening pass (2026-11-06)

| ID | Outcome | Owned paths | Depends on | Owner | Acceptance and verification |
| --- | --- | --- | --- | --- | --- |
| H1 | Public dashboard is useful without a wallet | Dashboard page and contract-state hooks | Baseline | Frontend worker | `/dashboard` renders live `clavis.testnet` read-only evidence; owner mutations remain wallet-gated |
| H2 | Public audit reaches useful content quickly | Audit page and RPC/enrichment utilities | Baseline | Frontend worker | Snapshot is fetched once, transaction-link enrichment is non-blocking, concurrent calls are deduplicated |
| H3 | Every payroll contract uses a restricted signer | Agent runtime/config/tests | Baseline | Agent worker | No Full Access opt-in remains; per-contract `request_payment` Function Call credentials are selected and isolated |
| H4 | Security claims are reproducible | CI workflow, threat model, generated report, security-evidence page | Baseline | Security worker + parent integration | Threat cases map to real tests and commit evidence; browser probes are labelled as demonstrations |
| H5 | Settlement evidence is honest and verifiable | Agent settlement records, UI/docs copy | H1 | Parent | Unsupported cross-chain routes fail without NEAR substitution; verified references identify route and settlement type |
| H6 | Privacy and AI positioning match the implementation | Marketing, guide, metadata, README/submission/security docs | H1-H4 | Parent | “Privacy-minimized” boundary is explicit; deterministic tests, not AI, are the security authority |
| H7 | Integrated release passes all gates | Whole repository | H1-H6 | Parent + QA reviewer | Agent/contract tests, typecheck, build, security-report generation, browser smoke and diff checks pass |

Critical path: `H1/H2/H3/H4 -> H5/H6 -> H7`. No fabricated mainnet or cross-chain transaction evidence is permitted. A funded settlement or deployment requiring wallet signing remains an external approval gate.

## Working assumptions

- Stage: implementation, integration, QA, deployment, and submission readiness.
- Deadline: not supplied; treat the submission as immediately due and protect the final 25% of effort for integration, browser QA, deployment, and rollback checks.
- Tracks: privacy, real-world utility, security, agents, and business tooling.
- Team capacity: parent integrator plus up to three isolated Codex workers.
- Cut line: no requested acceptance feature may be cut. If schedule pressure appears, reduce decorative animation and optional visual flourish before changing functionality.

## Dependency-aware task DAG

| ID | Outcome | Owned paths | Depends on | Owner | Acceptance and verification |
| --- | --- | --- | --- | --- | --- |
| T0 | Baseline and branch are current, routing fix integrated | Git history only | — | Parent | `feat/clavis-mvp` contains latest `main`; clean baseline; routing commit present |
| T1 | Safe NEAR AI Cloud interface and shared UI contracts | `api/ai.ts`, `frontend/api/ai.ts`, `frontend/src/utils/nearAi.ts`, shared type additions, env docs | T0 | Parent | Server-side key only; validated task payloads; timeout/error handling; frontend never bundles the key; API typecheck passes |
| T2 | Owner-only, no-funds five-scenario security audit recorded on-chain | `contract/src/security.rs`, required contract module/type/test files | T0 | Contract worker | Exactly five canonical blocked scenarios, owner-only, privacy-minimized audit entries, no transfers/state corruption; Rust tests and WASM build pass |
| T3 | Complete business, worker, and developer guides | New guide-only page/layout/content files | T0 | Guide worker | All supplied guide copy present; sidebar/mobile selector, progress, previous/next, try-it links, accessible semantics; frontend typecheck passes |
| T4 | Setup AI policy generation and route recommendation | `frontend/src/pages/SetupWizard.tsx` and new setup/recipient form components assigned in brief | T1 | Setup worker | Plain-English extraction auto-fills editable limits and recipient caps; readable summary; route recommendation can be accepted or overridden; mobile/keyboard behavior passes |
| T5 | Production dashboard controls and visible AI | Dashboard page/components, transaction helpers, toast lifecycle | T1, T2 | Parent | Anomaly analysis, CFO report, add/edit/delete recipient, validated limits/agent, pause banner/confirmation, two-step withdrawal, deterministic security probe feed, all writes use lifecycle toasts |
| T6 | Near-real-time audit and anomaly notification center | Audit/payment-history components, app notification component/hook | T5 | Parent | 10-second final-state polling plus focus refresh, newest-page anomaly reads, useful empty state, unread anomaly badge/dropdown/mark-read, dashboard anchor links |
| T7 | Guide/routes/navigation/SEO/404/mobile/loading integration | `App.tsx`, navigation/footer/landing, metadata hook, 404, global CSS, public banner | T3–T6 | Parent | Guide links everywhere, required CTAs, per-route OG metadata, branded 404, 375px behavior, skeletons replace blank loading states |
| T8 | Documentation and submission polish | `HACKATHON.md`, `.env.example`, README/guide references if needed | T1–T7 | Parent | Velo placeholder text exact; setup/deployment variables documented; no terminal instruction remains in user-facing UI |
| T9 | Independent QA and remediation | Read-only full repo review, then parent fixes | T2–T8 | QA reviewer + Parent | Security, correctness, accessibility, acceptance coverage, console/network errors, responsive screenshots; all critical findings closed |
| T10 | Release | Git branch, Vercel, NEAR testnet deployment where authorized | T9 | Parent | Full test/typecheck/build gate passes; browser smoke passes; branch pushed; contract deployment approval obtained before signing; merge to `main`; live URL verified |

## Critical path

`T0 → T1 → T4/T5 → T6 → T7 → T9 → T10`

The contract audit path `T0 → T2 → T5 → T9 → T10` runs in parallel. Guide content `T0 → T3 → T7` is isolated and runs in parallel.

## Integration checkpoints

1. Shared interfaces compile before setup/dashboard workers consume them.
2. Contract security audit tests pass before frontend integration assumes the method exists.
3. Each worker diff is reviewed and integrated separately; no shared-file blind merges.
4. Focused frontend typecheck after each UI slice.
5. Full Rust, agent, frontend, API, and production-build gate before browser QA.
6. Desktop and 375px Playwright smoke with console/network capture before release.
7. Public deployment and chain changes are verified separately, with wallet-signing approval required for NEAR upgrades.

## Evidence log

- Final API tests: 23 passed, including exact-block evidence, source-association rejection, semantic model failover, newest-page anomalies, and no-key verified fallbacks.
- Final agent tests: 54 passed, including newest-page anomaly monitoring, expired-window handling, security-probe filtering, private-plan persistence, owner authorization, worker notifications, and the complete off-hours window.
- Final payroll-contract tests: 22 passed; factory tests: 3 passed.
- Full TypeScript typecheck and production build passed.
- Five desktop/mobile browser proof-path tests passed with no horizontal overflow or console errors in tested routes.
- PR #9 was merged to `main` as `a7acd65`; main-branch CI, security evidence, browser smoke, and both Vercel production checks passed.
- Live policy, report, anomaly, route, and security requests returned HTTP 200 through `deepseek-ai/DeepSeek-V4.1-Flash-1017`; contract-backed tasks exposed exact final-block provenance.
- Root contract upgraded in transaction `6wQpeSvVKPG29Tc66H8J2ak6N4ESCyY9AWL8WvGsPXpj`; deployed hash `6KVr9Wh2JPibe796e7xEMCRQCqKzRAY5N6JPyPg5S3NV` matches the release WASM.
- Factory upgraded in transaction `7iPSiTGWogj4ovkcjh63gtbMUyY2HKUJMscMPVcwq3Mn`; deployed hash `DgajXyTxZbvwDznWM8udMDU5L3kDoAgqUHFDSzWKodsW` matches the factory release WASM.
- Oracle VPS runs the merged `main` release; PM2 and the private notification API are healthy, and the Vercel notification bridge reached the agent.
- Live five-scenario audit passed in transaction `Ng3cFYga534jZJJoFeAuzDgH5xLrMXP9Yrg52gkT4rc`.
- Release infrastructure gates are complete. Remaining work is limited to manual demo rehearsals, final video/submission assets, and any intentionally funded cross-chain settlement beyond the documented dry-run boundary.
