# Clavis judge-ready build plan

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
| T6 | Realtime audit and anomaly notification center | Audit/payment-history components, app notification component/hook | T5 | Parent | 30-second polling, animated new rows, useful empty state, unread anomaly badge/dropdown/mark-read, dashboard anchor links |
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

- Final agent tests: 31 passed, including private-plan persistence, owner authorization, worker notifications, and off-hours submission suppression.
- Final payroll-contract tests: 21 passed; factory tests: 3 passed.
- Full TypeScript typecheck and production build passed.
- Desktop and 375px browser smoke passed with no horizontal overflow or console errors in tested routes.
- Root contract upgraded in transaction `9EeKUbazVtDoNrEC1NsQixmigpeRuB2LbU9AwMmLFtAf`.
- Factory upgraded in transaction `AffW7NpTMUPvjaWenxemkSgFYdp4yzdp2HM6vLzsMnNh`.
- Local and deployed root/factory WASM SHA-256 hashes match.
- Live five-scenario audit passed in transaction `Ng3cFYga534jZJJoFeAuzDgH5xLrMXP9Yrg52gkT4rc`.
- Remaining external release gate: configure a valid `NEAR_AI_API_KEY` in Vercel and verify all five live AI tasks.
