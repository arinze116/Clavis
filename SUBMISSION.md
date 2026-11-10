# Clavis submission status

## Current status

The live Testnet root and factory now run v0.2.0. Contract-controlled native NEAR settlement is verified on-chain for both designated root workers and for a dedicated factory-created acceptance child. The backend agent remains healthy and restricted. Final frontend and repository changes are complete locally but have not been published; existing videos predate factory completion and must be updated before final publication.

Verified live state through 2026-11-10:

- `clavis.testnet` reports contract v0.2.0 with code hash `QzVUeXbKBPLMM14dDoLWCY8AKdSqJqeGxhGL3raM6bk`;
- `factory.clavis.testnet` reports v0.2.0 with code hash `HaSfbupBYJ77gJ1Dw3JXdztTBUZ7Du1xw2kMU6upmG1E`;
- the root upgrade and migration succeeded in transaction [`7DAC…KqWA`](https://testnet.nearblocks.io/txns/7DACvFhKgtGrrGENKAoZk23uHjMmRtP6wXotRFHTKqWA);
- the factory upgrade succeeded in transaction [`9RjG…Kdce`](https://testnet.nearblocks.io/txns/9RjGMTzWMCbPzndsSZQVw935UQRe8qGZYATCzEH9Kdce);
- factory child `clavis-v02-e2e-20261110.clavis.testnet` was created in transaction [`Dnch…q1qr`](https://testnet.nearblocks.io/txns/DnchBkKvWex7VWwmz5qE2aXDdDoYSzcq9BaoXC9kq1qr) and reports v0.2.0;
- the PM2 agent is online, reports v0.2.0, passes `/health`, and uses a `request_payment`-only Function Call key;
- payments 13 and 14 each transferred exactly 0.01 NEAR to the two designated worker accounts;
- root and child failed transfer, unauthorized caller/owner mutation, invalid creation/recipient, duplicate request, insufficient treasury, and restricted-key paths were verified;
- the production dashboard reads the upgraded root correctly; responsive screenshots at 320, 375, 768, 1024, and 1440 pixels passed inspection;
- the published caption-led video is historical pre-deployment evidence, not proof of the later live settlement;
- a pre-factory live-v0.2 release candidate was rendered and inspected locally; its factory-blocker claims are now superseded and it must not be published as final.

## Public release links

| Item | URL |
| --- | --- |
| Web app | <https://clavisapp.vercel.app> |
| Repository | <https://github.com/arinze116/Clavis> |
| Settlement implementation PR | <https://github.com/arinze116/Clavis/pull/13> |
| Source verification CI | <https://github.com/arinze116/Clavis/actions/runs/42602465954> |
| Security evidence CI | <https://github.com/arinze116/Clavis/actions/runs/42602465956> |
| Historical pre-deployment demo | <https://github.com/arinze116/Clavis/releases/download/v0.2.0-source-verified/clavis-demo-1080p.mp4> |
| Historical source-release evidence | <https://github.com/arinze116/Clavis/releases/tag/v0.2.0-source-verified> |
| Live root contract | <https://testnet.nearblocks.io/address/clavis.testnet> |
| Live factory | <https://testnet.nearblocks.io/address/factory.clavis.testnet> |

## Accurate product description

Clavis source v0.2 is a privacy-minimized testnet payroll application in which a restricted scheduler requests due native NEAR payments and the Rust payroll contract itself:

- enforces owner-defined policy;
- verifies the recipient-account commitment;
- transfers native NEAR from its treasury;
- records approval only after transfer success;
- rolls back spend and schedule state when transfer fails.

There is no agent-held Full Access settlement signer. Cross-chain and split execution are disabled until custody can remain contract-controlled end to end. The root account still has separate Full Access deployment authority outside contract enforcement; it is isolated in a manually unlocked Secret Service keychain and is not available to the backend process.

Private recipient changes are signed, durably staged, and promoted only after exact final-chain reconciliation. Wallet cancellation or service failure leaves the prior active plan unchanged.

## Browser behavior

- The dashboard detects contract versions and shows contract-controlled settlement for the live v0.2 root.
- Setup reports the live v0.2 factory before wallet connection and still blocks any legacy factory response.
- Mobile navigation lives in one persistent `AppShell` while dashboard content loads.
- The worker portal labels the employer-wide decision history and does not claim entries are worker-specific.
- Explorer links map emitted `payment_id` values to exact final transaction hashes; block/order guessing was removed. The current branch adds archival RPC fallback and keeps delayed enrichment when polling refreshes the audit.

## Cross-chain answer

**Is cross-chain payment live?**

No. The code does not run a dry-run relay. It rejects cross-chain execution visibly in both preflight and contract policy because the release cannot keep custody contract-controlled end to end. A cross-chain request does not consume daily capacity or advance the recipient schedule.

## Privacy answer

The audit entry omits amount and recipient identity, but standard NEAR function arguments and configured recipient policy remain public. There is no `CONFIDENTIAL_EXECUTOR_URL` adapter in this repository.

## Current local evidence

| Check | Result |
| --- | --- |
| Payroll contract | 31 passed |
| Secure signer tool | 12 passed |
| Agent Vitest | 66 passed |
| API, audit-link, RPC-boundary, and factory-acceptance tests | 50 passed |
| TypeScript typecheck | Passed |
| Factory tests and release WASM builds | 3 passed; payroll and factory WASM built |
| Production build | Passed |
| Playwright proof paths | 8 passed, including live-v0.2 and legacy-factory setup behavior |
| Complete repository gate | 170 tests/paths passed |
| Responsive visual QA | Inspected at 320, 375, 768, 1024, and 1440 px with no horizontal overflow, duplicate main landmarks, or page/console errors; the mobile menu stayed open |
| Production dependency audit | 0 moderate/high/critical; 17 low transitive `elliptic` advisories in the NEAR wallet stack |
| Production frontend | Published at <https://clavisapp.vercel.app>; both same-origin RPC deployments return live final-block data |
| Production rehearsals | Two uninterrupted runs across `/`, `/setup`, `/dashboard`, `/audit`, `/worker`, and `/security`; no application errors or horizontal overflow |
| Production screenshots | Live v0.2 dashboard inspected at five responsive widths; one `main`, one `h1`, zero horizontal overflow, and no visible layout defects |
| Historical demo render | H.264 High, 1920×1080, 30 fps, 95.9 s, 2,877 decoded frames, zero black segments at its release threshold; caption-led with no audio stream; recorded before the live root upgrade |
| Pre-factory live-v0.2 demo candidate | H.264 High, 1920×1080, 30 fps, 93.666667 s, 2,810 frames, zero black segments at the 0.2-second release threshold; caption-led with no audio stream; SHA-256 `eeae517ae861458aa18f938e64e6cba86941b01693b99fd7c48ec19a63f91acb`; superseded factory claims require a new render before publication |
| Live exact-link evidence | Payments 11–16 emitted exact `payment_id` events tied to final transaction hashes. Local tests cover same-block mapping, archival lookup, and delayed-enrichment polling races; publication of the last two fixes is pending. |
| Live contract hashes | Root/child `QzVUeXbKBPLMM14dDoLWCY8AKdSqJqeGxhGL3raM6bk`; factory `HaSfbupBYJ77gJ1Dw3JXdztTBUZ7Du1xw2kMU6upmG1E` |
| Deployment scripts | Root migration, factory deployment, dedicated child creation, and acceptance replay executed and verified with NEAR CLI RS v0.31.1 and final Testnet RPC. |

## Live Testnet transaction evidence

| Scenario | Payment | Transaction | Verified result |
| --- | ---: | --- | --- |
| Root upgrade and migration | — | [`7DAC…KqWA`](https://testnet.nearblocks.io/txns/7DACvFhKgtGrrGENKAoZk23uHjMmRtP6wXotRFHTKqWA) | Final success; deploy plus `migrate`; v0.2.0 reported afterward |
| Factory upgrade | — | [`9RjG…Kdce`](https://testnet.nearblocks.io/txns/9RjGMTzWMCbPzndsSZQVw935UQRe8qGZYATCzEH9Kdce) | Final success; reviewed v0.2 factory bytes deployed; registry and access key preserved |
| Factory child creation | — | [`Dnch…q1qr`](https://testnet.nearblocks.io/txns/DnchBkKvWex7VWwmz5qE2aXDdDoYSzcq9BaoXC9kq1qr) | Created and registered `clavis-v02-e2e-20261110.clavis.testnet` |
| Child native settlement | — | [`2Yid…ALHw`](https://testnet.nearblocks.io/txns/2YidaCUj1NGSbpF1HH3nmE6FJzSB8YN63Yzd8XQoALHw) | Approved and settled; recipient received exactly 0.001 NEAR |
| Failed native transfer | 11 | [`8V6x…BedB`](https://testnet.nearblocks.io/txns/8V6x9ZtCnqyh8B43sn5ty5f4gdSwfV8GMA2JjZG7BedB) | Rejected; reserved spend/schedule rolled back |
| Invalid recipient | 12 | [`DGDZ…odNT`](https://testnet.nearblocks.io/txns/DGDZ5e4uwmwnGM3DpQBsMj8AwCxCuy2HMLJdntJ8odNT) | Rejected without moving funds |
| Worker 1 settlement | 13 | [`Vjih…DLg`](https://testnet.nearblocks.io/txns/VjihUv5t54rEz177Eg1nYXogJw77mNxktnqyBYY2DLg) | Approved and settled; worker received 0.01 NEAR |
| Worker 2 settlement | 14 | [`CxK3…Yoht`](https://testnet.nearblocks.io/txns/CxK3vuAUv5bPooeuWafnvzpU2SryJY142keyw3knYoht) | Approved and settled; worker received 0.01 NEAR |
| Duplicate request | 15 | [`UjZB…sgA`](https://testnet.nearblocks.io/txns/UjZB6tkWQV2xyYyfYDQbNTuiBKiqhdWsfStdqTsqsgA) | Rejected: `Payment is not due` |
| Insufficient treasury | 16 | [`5vVK…7GH`](https://testnet.nearblocks.io/txns/5vVK4vXYpAbnoa2FEN4VGkhcbf63rJJfffetry6dS7GH) | Rejected without false settlement or accounting change |

## Submission checklist

- [x] Native funds originate from the v0.2 payroll contract in source.
- [x] Transfer success commits approval; failure rolls policy state back.
- [x] Cross-chain execution fails closed.
- [x] External settlement credentials are removed and rejected.
- [x] Private recipient changes use persisted two-phase reconciliation.
- [x] Dashboard and setup report the v0.2 root and factory and fail closed for legacy versions.
- [x] Worker history wording matches employer-wide audit data.
- [x] Explorer links use emitted payment IDs.
- [x] README, architecture, privacy, threat-model, and demo claims are aligned with source behavior.
- [x] Complete the local release gate with final recorded counts.
- [x] Deploy and verify the production frontend and same-origin RPC proxy.
- [x] Run two uninterrupted production browser rehearsals.
- [x] Capture and inspect production desktop, tablet, and mobile screenshots.
- [x] Render and inspect a truthful source-and-test demo without presenting v0.2 as live.
- [x] Add final app, repository, release, contract, CI, and demo URLs.
- [x] Upgrade `clavis.testnet` with owner-authorized `migrate`.
- [x] Upgrade `factory.clavis.testnet` so new children embed v0.2.
- [x] Deploy and restart the updated agent against the verified v0.2 root.
- [x] Confirm the upgraded root code hash and `contract_version` response.
- [x] Execute and link successful native settlements for both workers and one failed-transfer rollback transaction.
- [x] Verify live event-derived transaction hashes from v0.2 `payment_decision` events.
- [x] Render and inspect the historical pre-factory live-v0.2 release candidate.
- [x] Create and fully verify a dedicated factory v0.2 child.
- [ ] Publish the final guide, archival-RPC, and polling-race fixes after explicit owner approval.
- [ ] Update, inspect, and publish a factory-complete video after explicit owner approval.

The recovered factory credential remains isolated in the dedicated Clavis keyring and corresponds to the sole FullAccess key fingerprint `11ced76408bc820a`. Publication items are approval-gated. The available `clavis-agent.testnet` key remains Function Call restricted to `request_payment` on `clavis.testnet` and cannot deploy or upgrade code.
