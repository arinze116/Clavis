# Clavis submission status

## Current status

The v0.2 source has passed the local repository gate and is **not yet deployed or ready to publish as the live release**.

Verified live state on 2026-11-09:

- `clavis.testnet` reports contract v0.1.0;
- `factory.clavis.testnet` has no `contract_version` method and is treated as legacy;
- the live contracts therefore authorize requests but do not provide v0.2 contract-controlled settlement;
- no v0.2 deployment, Vercel publication, final rehearsal, or demo video was performed in this change.

## Accurate product description

Clavis source v0.2 is a privacy-minimized testnet payroll application in which a restricted scheduler requests due native NEAR payments and the Rust payroll contract itself:

- enforces owner-defined policy;
- verifies the recipient-account commitment;
- transfers native NEAR from its treasury;
- records approval only after transfer success;
- rolls back spend and schedule state when transfer fails.

There is no agent-held Full Access settlement signer. Cross-chain and split execution are disabled until custody can remain contract-controlled end to end. The legacy root contract still has separate Full Access deployment authority; that key is outside contract enforcement and must remain segregated from the agent host.

Private recipient changes are signed, durably staged, and promoted only after exact final-chain reconciliation. Wallet cancellation or service failure leaves the prior active plan unchanged.

## Browser behavior

- The dashboard detects contract versions and warns on legacy authorization-only deployments.
- Setup blocks a legacy factory rather than creating another v0.1 child.
- Mobile navigation lives in one persistent `AppShell` while dashboard content loads.
- The worker portal labels the employer-wide decision history and does not claim entries are worker-specific.
- Explorer links map emitted `payment_id` values to exact final transaction hashes; block/order guessing was removed.

## Cross-chain answer

**Is cross-chain payment live?**

No. The code does not run a dry-run relay. It rejects cross-chain execution visibly in both preflight and contract policy because the release cannot keep custody contract-controlled end to end. A cross-chain request does not consume daily capacity or advance the recipient schedule.

## Privacy answer

The audit entry omits amount and recipient identity, but standard NEAR function arguments and configured recipient policy remain public. There is no `CONFIDENTIAL_EXECUTOR_URL` adapter in this repository.

## Current local evidence

| Check | Result |
| --- | --- |
| Payroll contract | 28 passed |
| Agent Vitest | 66 passed |
| API, audit-link, and RPC-boundary tests | 30 passed |
| TypeScript typecheck | Passed |
| Factory tests and release WASM builds | 3 passed; payroll and factory WASM built |
| Production build | Passed |
| Playwright proof paths | 5 passed, including six delayed-load mobile-menu trials |
| Responsive visual QA | Inspected at 320, 375, 390, 768, 1024, and 1440 px with no horizontal overflow, duplicate main landmarks, console errors, or sub-44px visible controls |
| Production dependency audit | 0 moderate/high/critical; 17 low transitive `elliptic` advisories in the NEAR wallet stack |
| Live exact-link enrichment | Not verified: both available RPCs timed out on historical transaction-outcome lookup; deterministic event-mapping tests passed |
| Deployment scripts | `bash -n` syntax checks and NEAR CLI RS v0.31.1 source comparison passed; not executed because the CLI is absent and deployment is approval-gated |

## Submission checklist

- [x] Native funds originate from the v0.2 payroll contract in source.
- [x] Transfer success commits approval; failure rolls policy state back.
- [x] Cross-chain execution fails closed.
- [x] External settlement credentials are removed and rejected.
- [x] Private recipient changes use persisted two-phase reconciliation.
- [x] Dashboard and setup distinguish legacy deployments from v0.2.
- [x] Worker history wording matches employer-wide audit data.
- [x] Explorer links use emitted payment IDs.
- [x] README, architecture, privacy, threat-model, and demo claims are aligned with source behavior.
- [x] Complete the local release gate with final recorded counts.
- [ ] Upgrade `clavis.testnet` with owner-authorized `migrate`.
- [ ] Upgrade `factory.clavis.testnet` so new children embed v0.2.
- [ ] Deploy the updated frontend and agent.
- [ ] Confirm deployed code hashes and `contract_version` responses.
- [ ] Run two uninterrupted browser rehearsals and record the results.
- [ ] Capture desktop, tablet, and mobile screenshots from the deployed release.
- [ ] Record and inspect the final demo video.
- [ ] Add final app, repository, video, contract, and security-transaction URLs.

Do not mark any unchecked item complete without its evidence.
