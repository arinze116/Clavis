# Clavis submission status

## Current status

The v0.2 source is merged and the public frontend is deployed. The root contract, factory, and scheduler remain on the legacy deployment boundary, so the release is presented as **source-verified, not live-v0.2 settlement**.

Verified live state on 2026-11-09:

- `clavis.testnet` reports contract v0.1.0;
- `factory.clavis.testnet` has no `contract_version` method and is treated as legacy;
- the live contracts therefore authorize requests but do not provide v0.2 contract-controlled settlement;
- the production web app is live at <https://clavisapp.vercel.app> and visibly discloses that boundary;
- the required root and factory Full Access signers are absent from this host and GitHub Actions, so no v0.2 contract upgrade or agent restart was attempted;
- two production rehearsals, responsive screenshots, and a caption-led source-and-test demo are complete.

## Public release links

| Item | URL |
| --- | --- |
| Web app | <https://clavisapp.vercel.app> |
| Repository | <https://github.com/arinze116/Clavis> |
| Settlement implementation PR | <https://github.com/arinze116/Clavis/pull/13> |
| Source verification CI | <https://github.com/arinze116/Clavis/actions/runs/42602465954> |
| Security evidence CI | <https://github.com/arinze116/Clavis/actions/runs/42602465956> |
| Caption-led demo | <https://github.com/arinze116/Clavis/releases/download/v0.2.0-source-verified/clavis-demo-1080p.mp4> |
| Release evidence and screenshots | <https://github.com/arinze116/Clavis/releases/tag/v0.2.0-source-verified> |
| Live root contract | <https://testnet.nearblocks.io/address/clavis.testnet> |
| Live factory | <https://testnet.nearblocks.io/address/factory.clavis.testnet> |

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
| Payroll contract | 31 passed |
| Agent Vitest | 66 passed |
| API, audit-link, and RPC-boundary tests | 30 passed |
| TypeScript typecheck | Passed |
| Factory tests and release WASM builds | 3 passed; payroll and factory WASM built |
| Production build | Passed |
| Playwright proof paths | 5 passed, including six delayed-load mobile-menu trials |
| Responsive visual QA | Inspected at 320, 375, 390, 768, 1024, and 1440 px with no horizontal overflow, duplicate main landmarks, console errors, or sub-44px visible controls |
| Production dependency audit | 0 moderate/high/critical; 17 low transitive `elliptic` advisories in the NEAR wallet stack |
| Production frontend | Published at <https://clavisapp.vercel.app>; both same-origin RPC deployments return live final-block data |
| Production rehearsals | Two uninterrupted runs across `/`, `/setup`, `/dashboard`, `/audit`, `/worker`, and `/security`; no application errors or horizontal overflow |
| Production screenshots | 390, 768, and 1440 px inspected; one `main`, one `h1`, zero horizontal overflow, and no visible layout defects |
| Demo render | H.264 High, 1920×1080, 30 fps, 95.9 s, 2,877 decoded frames, zero detected black segments; caption-led with no audio stream |
| Live exact-link enrichment | Production verification found no v0.2 `payment_decision` event mapping for the legacy audit, so the UI correctly fell back to block links. Deterministic event-mapping tests passed; a live exact transaction link requires the signer-gated v0.2 settlement transaction. |
| Live contract hashes | Root `6KVr9Wh2JPibe796e7xEMCRQCqKzRAY5N6JPyPg5S3NV`; factory `DgajXyTxZbvwDznWM8udMDU5L3kDoAgqUHFDSzWKodsW` |
| Deployment scripts | `bash -n` syntax checks and NEAR CLI RS v0.31.1 source comparison passed; not executed because the CLI and required Full Access signers are absent |

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
- [x] Deploy and verify the production frontend and same-origin RPC proxy.
- [x] Run two uninterrupted production browser rehearsals.
- [x] Capture and inspect production desktop, tablet, and mobile screenshots.
- [x] Render and inspect a truthful source-and-test demo without presenting v0.2 as live.
- [x] Add final app, repository, release, contract, CI, and demo URLs.
- [ ] Upgrade `clavis.testnet` with owner-authorized `migrate`.
- [ ] Upgrade `factory.clavis.testnet` so new children embed v0.2.
- [ ] Deploy and restart the updated agent after both contracts report v0.2.0 or newer.
- [ ] Confirm the upgraded v0.2 code hashes and `contract_version` responses.
- [ ] Execute and link one successful native settlement and one failed-transfer rollback transaction.
- [ ] Verify a live event-derived transaction link from a v0.2 `payment_decision` event.

The unchecked items all require the segregated root/factory signers. The available `clavis-agent.testnet` key is Function Call restricted to `request_payment` on `clavis.testnet`; it cannot deploy or upgrade code. Do not mark an unchecked item complete without signed testnet evidence.
