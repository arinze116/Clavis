# Clavis v0.2 full execution report

Execution date: 2026-11-09

Workspace: `/home/ubuntu/Clavis1`

Network: NEAR Testnet only

## Verdict

**PARTIAL — DEPLOYED BUT ACCEPTANCE TESTS INCOMPLETE**

The root payroll contract and backend agent run v0.2.0 on Testnet. Both designated workers received one contract-controlled 0.01 NEAR payment, and live failure cases proved rollback and duplicate protection. The factory remains legacy because its distinct on-chain Full Access signer is unavailable. The final guide, archival-RPC, polling-race, and live-video changes are prepared locally but are not published under the current approval gate.

## Verified environment

| Item | Verified result |
| --- | --- |
| VPS | Ubuntu 24.04.5 LTS, aarch64, 64-bit |
| NEAR CLI | near-cli-rs 0.31.1, checksum-pinned aarch64 binary |
| Signer storage | Dedicated, manually unlocked GNOME Secret Service keychain |
| Owner | `clavis.testnet` — existing FullAccess signer verified |
| Worker 1 | `arinze-worker1.testnet` — existing FullAccess signer verified |
| Worker 2 | `arinze-worker2.testnet` — existing FullAccess signer verified |
| Backend agent | `clavis-agent.testnet` — backend-only Function Call key |
| Factory | `factory.clavis.testnet` — separate unmatched FullAccess signer |

Signer fingerprints and non-mutating signing evidence are in `docs/reports/clavis-near-signer-connection-20261109.md`. No private key, recovery phrase, keyring password, or secret-bearing environment value is included here.

## Network and transaction safety gates

Before live operations, the execution scripts required:

- network connection `testnet` or the explicitly configured `testnet-drpc` connection;
- a recognized HTTPS NEAR Testnet RPC endpoint;
- `.testnet` target and signer account IDs;
- exact root, factory, owner, agent, and worker identities;
- keychain public-key identity checks before signing;
- final-state verification after every state-changing transaction.

No Mainnet endpoint, account, deployment, or transfer was used.

## Baseline and preservation

The pre-upgrade baseline is stored outside the repository at:

`/home/ubuntu/.local/state/clavis-v02-20261109-final/baseline.json`

It captured the root and factory account balances, access-key permissions, code hashes, downloaded-code hashes, root owner/agent/limits, three existing recipients, ten audit entries, one anomaly, the factory registry, and preservation hashes for protected agent files.

The migration preserved:

- owner `clavis.testnet`;
- agent `clavis-agent.testnet`;
- 100 NEAR daily limit and 20 NEAR per-payment limit;
- the three original recipient policies and schedules;
- audit entries 1–10;
- the existing anomaly record;
- root access keys and backend credential separation.

The two designated workers were added only after migration. A temporary failed-transfer probe was removed, and Worker 2's temporary insufficient-funds cap/schedule changes were restored exactly.

## Contract deployment and code evidence

| Target | Before | After / current | Result |
| --- | --- | --- | --- |
| `clavis.testnet` | v0.1.0, code hash `6KVr9Wh2JPibe796e7xEMCRQCqKzRAY5N6JPyPg5S3NV` | v0.2.0, code hash `QzVUeXbKBPLMM14dDoLWCY8AKdSqJqeGxhGL3raM6bk` | Upgraded and migrated |
| `factory.clavis.testnet` | Legacy, code hash `DgajXyTxZbvwDznWM8udMDU5L3kDoAgqUHFDSzWKodsW` | Unchanged; `contract_version` is unavailable | Blocked by missing exact signer |

Local release artifacts:

| Artifact | SHA-256 |
| --- | --- |
| `contract/res/clavis_contract.wasm` | `06255d262d74c07b1d95be12f711a451a1a2abe5c30b7344d2ee1d97ab28fe63` |
| `contract/res/clavis_factory.wasm` | `f64c2d7a8b9ce47c5922c6beb65ac8c579110f6286f2b7aa4b26559b72f7bf39` |

### Root migration transaction

- Transaction: [`7DACvFhKgtGrrGENKAoZk23uHjMmRtP6wXotRFHTKqWA`](https://testnet.nearblocks.io/txns/7DACvFhKgtGrrGENKAoZk23uHjMmRtP6wXotRFHTKqWA)
- Signer and receiver: `clavis.testnet`
- Actions: `DeployContract`, then `migrate`
- Final status: success
- Postcondition: `contract_version` returned `0.2.0` and the expected code hash

### Factory blocker

`factory.clavis.testnet` has one FullAccess key. It does not match the verified owner, worker, or backend-agent signers. Guessing an identity, creating a replacement key, or modifying on-chain permissions would violate the signer-preservation requirements, so the factory upgrade stopped before signing.

## Backend agent deployment

| Check | Verified result |
| --- | --- |
| PM2 service | `clavis-agent`, online, version 0.2.0 |
| Deployed source head | `9f7f7c2520afa4c8745522d45164770c1e962369` |
| Health endpoint | `http://127.0.0.1:8787/health` returned `{"ok":true}` |
| Contract admission | Connected to `clavis.testnet` v0.2.0 |
| Key mode | Restricted |
| On-chain key permission | Receiver `clavis.testnet`; method list contains only `request_payment` |
| Credential boundary | Existing backend-only credential preserved; not imported into browser or owner keychain |

The deployment script now uses the PM2 ecosystem file with `startOrRestart`, ensuring `DOTENV_CONFIG_PATH` is loaded. No unrelated PM2 process was restarted or modified.

## Successful payroll settlement

| Worker | Payment | Amount | Transaction | Event result |
| --- | ---: | ---: | --- | --- |
| `arinze-worker1.testnet` | 13 | 0.01 NEAR | [`VjihUv5t54rEz177Eg1nYXogJw77mNxktnqyBYY2DLg`](https://testnet.nearblocks.io/txns/VjihUv5t54rEz177Eg1nYXogJw77mNxktnqyBYY2DLg) | `payment_decision`, Approved, settled |
| `arinze-worker2.testnet` | 14 | 0.01 NEAR | [`CxK3vuAUv5bPooeuWafnvzpU2SryJY142keyw3knYoht`](https://testnet.nearblocks.io/txns/CxK3vuAUv5bPooeuWafnvzpU2SryJY142keyw3knYoht) | `payment_decision`, Approved, settled |

Balance proof captured immediately around the payroll run:

| Account | Before | After | Exact change |
| --- | ---: | ---: | ---: |
| `arinze-worker1.testnet` | 1.9991121763030394 NEAR | 2.0091121763030394 NEAR | +0.01 NEAR |
| `arinze-worker2.testnet` | 10 NEAR | 10.01 NEAR | +0.01 NEAR |
| `clavis.testnet` | 9.9393425195409368 NEAR | 9.9193425195409368 NEAR | -0.02 NEAR |

Postconditions:

- daily spend became exactly 0.02 NEAR;
- both worker schedules advanced once;
- audit entries 13 and 14 were Approved;
- no native payment remained pending;
- the contract, not a separate settlement wallet, originated both transfers.

## Live failure and recovery evidence

| Scenario | Payment | Transaction / evidence | Verified result |
| --- | ---: | --- | --- |
| Failed native transfer | 11 | [`8V6x9ZtCnqyh8B43sn5ty5f4gdSwfV8GMA2JjZG7BedB`](https://testnet.nearblocks.io/txns/8V6x9ZtCnqyh8B43sn5ty5f4gdSwfV8GMA2JjZG7BedB) | Rejected `Native NEAR transfer failed`; daily spend and schedule rolled back; no pending payment |
| Unauthorized caller | 0 | [`GZCDKytgEsvHYYVhCpGYnj4wGcg71PfWHVnbTGXTYLiq`](https://testnet.nearblocks.io/txns/GZCDKytgEsvHYYVhCpGYnj4wGcg71PfWHVnbTGXTYLiq) | Worker-signed `request_payment` rejected; no payment entry or transfer |
| Invalid recipient | 12 | [`DGDZ5e4uwmwnGM3DpQBsMj8AwCxCuy2HMLJdntJ8odNT`](https://testnet.nearblocks.io/txns/DGDZ5e4uwmwnGM3DpQBsMj8AwCxCuy2HMLJdntJ8odNT) | Rejected `Recipient not approved`; balances and spend unchanged |
| Duplicate settlement | 15 | [`UjZB6tkWQV2xyYyfYDQbNTuiBKiqhdWsfStdqTsqsgA`](https://testnet.nearblocks.io/txns/UjZB6tkWQV2xyYyfYDQbNTuiBKiqhdWsfStdqTsqsgA) | Rejected `Payment is not due`; no duplicate transfer |
| Insufficient treasury | 16 | [`5vVK4vXYpAbnoa2FEN4VGkhcbf63rJJfffetry6dS7GH`](https://testnet.nearblocks.io/txns/5vVK4vXYpAbnoa2FEN4VGkhcbf63rJJfffetry6dS7GH) | Rejected; contract/worker balances, daily spend, and last-paid state unchanged |
| Forbidden agent mutation | — | On-chain access-key query plus attempted `add_recipient` | Protocol key policy rejected the method; recipient state remained unchanged |
| Crash-safe payroll resume | — | `acceptance-payroll-resume.json` followed by the final run | An unchanged baseline was classified as pending and resumed once; ambiguous partial progress fails closed in tests |

The final audit count is 16. The failed-transfer callback path was demonstrated live. The rarer case in which the callback itself never finalizes is covered by deterministic contract tests, including the ten-minute owner recovery path, but was not forced on live Testnet because doing so safely would require manufacturing an abnormal runtime condition.

## Frontend and explorer integration

Verified against the live upgraded root:

- dashboard showed contract-controlled native settlement on v0.2.0;
- recipients, treasury, daily spend, audit decisions 11–15, policy, and anomalies reflected chain state;
- payment IDs 11–16 were independently mapped to the exact final transactions from emitted `payment_decision` events;
- worker history remained labelled employer-wide;
- setup remained blocked by the legacy factory;
- mobile navigation stayed open during delayed dashboard loading;
- screenshots at 320, 375, 768, 1024, and 1440 pixels had one `main`, one `h1`, and no horizontal overflow or page/console errors.

Screenshots:

- `artifacts/ui/live-v02-dashboard-320.png`
- `artifacts/ui/live-v02-dashboard-375.png`
- `artifacts/ui/live-v02-dashboard-768.png`
- `artifacts/ui/live-v02-dashboard-1024.png`
- `artifacts/ui/live-v02-dashboard-1440.png`

Production verification exposed two explorer-reliability defects: historical transactions sometimes require an archival RPC, and a ten-second poll could replace a snapshot before slower enrichment finished. The local branch now adds the archival fallback and merges delayed links into the latest matching audit snapshot, with regression tests. Those fixes and the corrected static guide have not been published.

The changed local Security Evidence page and developer-guide step were also captured at 390, 768, and 1440 pixels under `artifacts/ui/final-local/`. Every run had one `main`, one `h1`, zero horizontal overflow, and no page or console errors; the new 156-check metrics and live-root/legacy-factory copy were visually readable.

## Automated verification

Primary release command:

```bash
bash scripts/verify.sh
```

Recorded final suite counts:

| Suite | Passed |
| --- | ---: |
| Payroll contract | 31 |
| Factory contract | 3 |
| Secure signer importer | 7 |
| Agent Vitest | 66 |
| API and utility Node tests | 44 |
| Playwright browser paths | 5 |
| Total | 156 |

The gate also covers Rust formatting, signer clippy with warnings denied, both contract WASM builds, TypeScript and Testnet-script typechecks, production build, demo typecheck, generated security-evidence freshness, production dependency audit, deployment-script syntax, and `git diff --check`.

Generated security evidence contains 29 mapped threats, current source hashes/line numbers, and the 156-check total.

## Non-blocking warnings

- `npm audit --omit=dev --audit-level=moderate` passed its threshold but reported 17 low-severity `elliptic` advisories in the NEAR wallet dependency tree. The advertised automatic fix requires a breaking `near-api-js` upgrade and was not forced into this release.
- Vite completed the production build but reported large wallet/provider chunks and vendor `eval` warnings. These are performance and supply-chain review items, not failed build output.
- The live agent logs deprecation warnings for legacy `near-api-js` `Near` and `Connection` constructors. The service remains healthy, but a future dependency migration should construct `Account` directly.
- Factory discovery includes two legacy child contracts without private payroll plans. The agent logs `payroll.plan_missing` and fails closed for them; this is safe but noisy until legacy registry handling is refined.

## Incomplete or not verified

- **Factory upgrade:** blocked by the unavailable exact FullAccess signer for `factory.clavis.testnet`.
- **New factory-created v0.2 child:** not attempted because the live factory is legacy.
- **Forced missing-callback recovery on live Testnet:** deterministic contract tests pass, but no safe live mechanism was used to suppress a protocol callback deliberately.
- **Final frontend publication:** local guide, archival-RPC, and enrichment-race fixes are not deployed because publishing requires separate explicit approval.
- **New live-v0.2 demo publication:** the existing public video is historical pre-deployment evidence; a replacement was not published under the same approval gate.
- **Mainnet:** deliberately not tested or touched.

## Security and infrastructure preservation

- No private key, recovery phrase, keyring password, or full secret-bearing environment value was printed or committed.
- No account or access key was generated, replaced, added, deleted, or modified on-chain.
- The backend agent credential remains backend-only and separate from the owner/worker keychain.
- The Telegram bot, Telegram control plane, Local Bot API, shared Codex service, Video Studio, SSH configuration, and unrelated PM2 services were not modified.
- No Mainnet transaction or fund transfer occurred.
- Live acceptance state was restored after temporary controlled failure scenarios.

## Completion report

- **Requested:** Complete v0.2 Testnet deployment, migration, integration, payroll settlement, failure testing, documentation, and evidence.
- **Implemented:** Root v0.2 migration, agent deployment, two-worker payroll, live failure controls, safe resume logic, explorer archival fallback, polling-safe link enrichment, accurate public documentation, and regenerated evidence.
- **Tested:** Full 156-check repository gate, read-only final RPC state, final transaction receipts/events, balances, PM2 health, access-key permissions, and five responsive dashboard widths.
- **Passed:** Root deployment/migration, agent health, both worker payments, rollback, unauthorized/invalid/duplicate/insufficient controls, restricted key policy, responsive dashboard, and automated gate.
- **Failed:** No completed test produced an unexplained failure.
- **Incomplete:** Factory upgrade, final frontend/video publication, and a deliberately suppressed live callback.
- **Not verified:** Mainnet and a new factory-created v0.2 child.
- **Risk:** Root FullAccess authority remains outside contract enforcement; the keychain is isolated from the agent process, but VPS compromise remains a custody risk. Owner stale-callback attestation also depends on correct receipt review. Low-severity wallet dependency advisories and the agent's deprecated NEAR client constructors remain documented maintenance work.
- **Next step:** Obtain and verify the exact existing factory signer, then separately approve publication of this branch and the refreshed live-v0.2 demo.

## Scorecard evidence — no self-scores

| Criterion | Evidence |
| --- | --- |
| Engineering — correctness | Final receipts, emitted payment IDs, exact balance deltas, rollback state, and code hashes were checked against Testnet. |
| Engineering — tests | 31 payroll, 3 factory, 7 signer, 66 agent, 44 API/utility, and 5 browser checks pass. |
| Engineering — architecture | Contract-controlled settlement, restricted agent authority, two-phase private-plan reconciliation, archival RPC fallback, and polling-safe enrichment are documented and tested. |
| Design — responsiveness | Five production dashboard widths were visually inspected with one main landmark, one h1, no overflow, and stable mobile navigation. |
| Design — usability | The UI distinguishes the v0.2 root, legacy factory, employer-wide history, pending/error states, and best-effort explorer evidence. |
| Branding — consistency | Existing Clavis visual system and terminology were preserved; no unsupported marketing claim remains in current source/docs. |
| Video | The existing render was inspected previously and is now labelled historical; a new live-v0.2 render remains explicitly incomplete. |
| Research — accuracy | Installed CLI/help, live RPC, transaction receipts, access keys, PM2 state, generated evidence, and repository source were cross-checked. |
| Productivity — prioritisation | Existing transactions were recovered and verified instead of repeated; safe independent work continued while the factory signer remained unavailable. |
| Memory — consistency | The stale organisation record will be superseded with this report's verified live state; no secret material will be stored. |
