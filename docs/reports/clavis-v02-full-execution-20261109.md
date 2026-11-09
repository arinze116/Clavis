# Clavis v0.2 full execution report

Execution date: 2026-11-09

Workspace: `/home/ubuntu/Clavis1`

Network: NEAR Testnet only

## Verdict

**BLOCKED — EXTERNAL REQUIREMENT PREVENTS COMPLETION**

The deployed root payroll system is end-to-end verified on Testnet: `clavis.testnet` runs v0.2.0, the restricted backend agent is healthy, both designated workers received contract-controlled native NEAR, and live failure cases proved rollback, duplicate protection, access control, and insufficient-treasury handling. The frontend and a truthful live-v0.2 video release candidate are complete locally.

The only deployment blocker is the unavailable existing Full Access credential for `factory.clavis.testnet`. The factory has no contract-level upgrade method, and its sole Full Access key does not match the verified owner or worker signers. No factory transaction was attempted. Frontend, repository, and video publication are also waiting for the separate external publication approval gate.

## Verified environment and identities

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

Signer fingerprints and non-mutating signing evidence are recorded in `docs/reports/clavis-near-signer-connection-20261109.md`. No private key, recovery phrase, keyring password, or secret-bearing environment value is included in this report.

## Network and transaction safety gates

Before every completed live operation, the deployment scripts required:

- network connection `testnet` or the explicitly configured `testnet-drpc` connection;
- a recognized HTTPS NEAR Testnet RPC endpoint;
- `.testnet` target and signer account IDs;
- exact root, factory, owner, agent, and worker identities;
- keychain public-key identity checks before signing;
- final-state verification before any retry.

No Mainnet endpoint, account, deployment, or transfer was used.

## Baseline and preservation

The pre-upgrade baseline is stored outside the repository at:

`/home/ubuntu/.local/state/clavis-v02-20261109-final/baseline.json`

It captured account balances, access-key permissions, deployed and downloaded code hashes, root policy, recipients, audit entries, anomalies, the factory registry, and preservation hashes for protected agent files.

The migration preserved the owner, agent, 100 NEAR daily limit, 20 NEAR per-payment limit, three original recipient policies and schedules, audit entries 1–10, the existing anomaly record, root access keys, and backend credential separation. The two designated workers were added after migration. Temporary failure-test state was removed or restored.

## Root contract deployment

| Target | Before | Current | Result |
| --- | --- | --- | --- |
| `clavis.testnet` | v0.1.0; code hash `6KVr9Wh2JPibe796e7xEMCRQCqKzRAY5N6JPyPg5S3NV` | v0.2.0; code hash `QzVUeXbKBPLMM14dDoLWCY8AKdSqJqeGxhGL3raM6bk` | Upgraded and migrated |
| `factory.clavis.testnet` | Legacy; code hash `DgajXyTxZbvwDznWM8udMDU5L3kDoAgqUHFDSzWKodsW` | Unchanged; `contract_version` absent | Blocked by missing exact signer |

Local release artifacts:

| Artifact | SHA-256 |
| --- | --- |
| `contract/res/clavis_contract.wasm` | `06255d262d74c07b1d95be12f711a451a1a2abe5c30b7344d2ee1d97ab28fe63` |
| `contract/res/clavis_factory.wasm` | `f64c2d7a8b9ce47c5922c6beb65ac8c579110f6286f2b7aa4b26559b72f7bf39` |

Root upgrade and migration transaction:

- transaction: [`7DACvFhKgtGrrGENKAoZk23uHjMmRtP6wXotRFHTKqWA`](https://testnet.nearblocks.io/txns/7DACvFhKgtGrrGENKAoZk23uHjMmRtP6wXotRFHTKqWA);
- signer and receiver: `clavis.testnet`;
- actions: `DeployContract`, then `migrate`;
- final status: success;
- postcondition: `contract_version` returned `0.2.0` and the expected code hash.

## Factory authority investigation

Fresh final-block Testnet evidence is stored at `artifacts/publication/clavis-v02-20261109/evidence/factory-authority-audit.json`.

| Property | Verified result |
| --- | --- |
| Account | `factory.clavis.testnet` |
| Current code hash | `DgajXyTxZbvwDznWM8udMDU5L3kDoAgqUHFDSzWKodsW` |
| Current version | Legacy; `contract_version` returns `MethodNotFound` |
| Registry methods | `get_root_account` and `get_all_contracts` work |
| Upgrade methods | `upgrade`, `migrate`, and `get_owner` are absent |
| On-chain authority | One FullAccess key only |
| Required public key | `ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD` |
| Required-key fingerprint | `11ced76408bc820a` |
| Match to owner/workers | No |

The current factory source remains storage-compatible with the legacy deployment; the v0.2 factory adds version reporting and embeds the v0.2 payroll WASM. That compatibility does not grant upgrade authority. Because the deployed legacy code has no self-upgrade path, only a transaction signed by the exact factory-account Full Access key can deploy the replacement code.

A factory-only importer is complete and fail-closed:

- launcher: `scripts/connect-factory-signer.sh`;
- hidden `/dev/tty` input only;
- exact public-key pinning before persistence;
- live FullAccess verification;
- Secret Service round-trip and NEAR CLI retrieval;
- non-mutating NEP-413 signing challenge;
- no deployment or state-changing transaction.

The installed signer binary SHA-256 is `b40428334ff96446ff8964bbce7ece1990ece1d5148dfb5952e5a55d2997b3bc`, and all launchers pin it. The preflight report is `docs/reports/clavis-near-factory-signer-preflight-20261109.md`.

Exact unblock action, run only by the credential holder in a trusted SSH terminal:

```bash
cd /home/ubuntu/Clavis1
bash scripts/connect-factory-signer.sh
```

The credential must never be pasted into chat. No factory upgrade was attempted without it.

## Backend agent

| Check | Verified result |
| --- | --- |
| PM2 service | `clavis-agent`, online, version 0.2.0 |
| Health endpoint | `http://127.0.0.1:8787/health` returned `{"ok":true}` |
| Contract admission | Connected to `clavis.testnet` v0.2.0 |
| On-chain key permission | Receiver `clavis.testnet`; method list contains only `request_payment` |
| Credential boundary | Existing backend-only credential preserved; not imported into browser or owner keychain |

No unrelated PM2 process or VPS service was restarted or modified during the completion sprint.

## Successful payroll settlement

| Worker | Payment | Amount | Transaction | Result |
| --- | ---: | ---: | --- | --- |
| `arinze-worker1.testnet` | 13 | 0.01 NEAR | [`VjihUv5t54rEz177Eg1nYXogJw77mNxktnqyBYY2DLg`](https://testnet.nearblocks.io/txns/VjihUv5t54rEz177Eg1nYXogJw77mNxktnqyBYY2DLg) | Approved and settled |
| `arinze-worker2.testnet` | 14 | 0.01 NEAR | [`CxK3vuAUv5bPooeuWafnvzpU2SryJY142keyw3knYoht`](https://testnet.nearblocks.io/txns/CxK3vuAUv5bPooeuWafnvzpU2SryJY142keyw3knYoht) | Approved and settled |

Captured balance deltas:

| Account | Before | After | Exact change |
| --- | ---: | ---: | ---: |
| `arinze-worker1.testnet` | 1.9991121763030394 NEAR | 2.0091121763030394 NEAR | +0.01 NEAR |
| `arinze-worker2.testnet` | 10 NEAR | 10.01 NEAR | +0.01 NEAR |
| `clavis.testnet` | 9.9393425195409368 NEAR | 9.9193425195409368 NEAR | -0.02 NEAR |

The contract, not a separate settlement wallet, originated both transfers. Daily spend became 0.02 NEAR, both schedules advanced once, audit entries 13 and 14 were Approved, and no native payment remained pending.

## Failure and recovery evidence

| Scenario | Payment | Transaction | Verified result |
| --- | ---: | --- | --- |
| Failed native transfer | 11 | [`8V6x9ZtCnqyh8B43sn5ty5f4gdSwfV8GMA2JjZG7BedB`](https://testnet.nearblocks.io/txns/8V6x9ZtCnqyh8B43sn5ty5f4gdSwfV8GMA2JjZG7BedB) | Rejected; spend and schedule rolled back |
| Unauthorized caller | 0 | [`GZCDKytgEsvHYYVhCpGYnj4wGcg71PfWHVnbTGXTYLiq`](https://testnet.nearblocks.io/txns/GZCDKytgEsvHYYVhCpGYnj4wGcg71PfWHVnbTGXTYLiq) | Worker-signed request rejected; no transfer |
| Invalid recipient | 12 | [`DGDZ5e4uwmwnGM3DpQBsMj8AwCxCuy2HMLJdntJ8odNT`](https://testnet.nearblocks.io/txns/DGDZ5e4uwmwnGM3DpQBsMj8AwCxCuy2HMLJdntJ8odNT) | Rejected; balances and spend unchanged |
| Duplicate settlement | 15 | [`UjZB6tkWQV2xyYyfYDQbNTuiBKiqhdWsfStdqTsqsgA`](https://testnet.nearblocks.io/txns/UjZB6tkWQV2xyYyfYDQbNTuiBKiqhdWsfStdqTsqsgA) | Rejected `Payment is not due`; no duplicate transfer |
| Insufficient treasury | 16 | [`5vVK4vXYpAbnoa2FEN4VGkhcbf63rJJfffetry6dS7GH`](https://testnet.nearblocks.io/txns/5vVK4vXYpAbnoa2FEN4VGkhcbf63rJJfffetry6dS7GH) | Rejected; no false settlement or accounting change |
| Forbidden agent mutation | — | On-chain key query and attempted `add_recipient` | Protocol key policy rejected the method |
| Crash-safe resume | — | Persisted payroll-resume evidence | Unchanged baseline resumed once; ambiguous progress fails closed |

Fresh read-only transaction and state revalidation is stored in:

- `artifacts/publication/clavis-v02-20261109/evidence/live-acceptance-audit.json`;
- `artifacts/publication/clavis-v02-20261109/evidence/failure-acceptance-audit.json`.

No successful operation was repeated during the completion sprint.

## Frontend integration and responsive QA

The local frontend release candidate:

- reads the live v0.2 root and distinguishes it from the legacy factory;
- discloses the blocked factory on `/setup` before wallet connection;
- shows contract-controlled native settlement, recipients, treasury, spend, decisions, policy, and anomalies from live state;
- maps emitted `payment_id` events to exact transactions and keeps archival/delayed enrichment stable across polling;
- labels worker history as employer-wide;
- keeps one `AppShell` mounted while data loads, preserving the mobile menu;
- fails closed for unsupported cross-chain and split routes.

Responsive release-candidate QA covered `/`, `/dashboard`, `/setup`, and `/security` at 390, 768, and 1440 pixels. All 12 captures had one `main`, one `h1`, zero horizontal overflow, and zero page or console errors. Six delayed-load mobile-menu trials remained open and usable.

Accessibility evidence confirms the skip link receives first focus, `lang="en"` is set, visible critical controls meet the 44-pixel minimum target, and no unnamed buttons or images without alt text were found.

Evidence:

- `artifacts/publication/clavis-v02-20261109/ui/`;
- `artifacts/publication/clavis-v02-20261109/ui-audit.json`;
- `artifacts/publication/clavis-v02-20261109/accessibility-audit.json`.

The frontend release candidate is not published under the external publication approval gate.

## Live-v0.2 video release candidate

The final local asset is:

`artifacts/publication/clavis-v02-20261109/video/clavis-live-v02-1080p.mp4`

| Property | Verified result |
| --- | --- |
| SHA-256 | `eeae517ae861458aa18f938e64e6cba86941b01693b99fd7c48ec19a63f91acb` |
| Container and codec | MP4; H.264 High; yuv420p |
| Dimensions and rate | 1920×1080; 30 fps |
| Duration and frames | 93.666667 seconds; 2,810 frames |
| Audio | No audio stream by design; timed captions carry narration |
| Black-frame scan | Zero segments at the 0.2-second release threshold; three 0.1-second transition dips at a stricter threshold |

Exact first and last frames, the contact sheet, and individual opening, root/factory, restricted-key, callback, reconciliation, audit, security, and end-card frames were inspected. Captions are legible. Claims are limited to the verified live root, two completed worker settlements, restricted agent authority, callback rollback, durable recipient reconciliation, employer-wide audit history, 159 local checks, and the unavailable factory signer. The video does not claim that the factory is upgraded or that the local frontend is already public.

Inspection evidence is under `artifacts/publication/clavis-v02-20261109/video-inspection/`. Publication has not occurred.

## Automated verification

Primary release command:

```bash
bash scripts/verify.sh
```

| Suite | Passed |
| --- | ---: |
| Payroll contract | 31 |
| Factory contract | 3 |
| Secure signer importer | 9 |
| Agent Vitest | 66 |
| API and utility Node tests | 44 |
| Playwright browser paths | 6 |
| Total | 159 |

The gate also covers Rust formatting, signer Clippy with warnings denied, both contract WASM builds, TypeScript and Testnet-script typechecks, production builds, demo typecheck, generated security-evidence freshness, production dependency audit, deployment-script syntax, and `git diff --check`.

Final gate result: passed on the final release-candidate working tree; all 159 tests and browser paths completed successfully.

Additional release checks:

- production dependency audit: zero moderate, high, or critical findings; 17 low transitive `elliptic` advisories remain in the NEAR wallet stack;
- custom tracked/untracked secret-pattern scan: 231 source, report, and text-evidence files scanned; zero findings;
- Markdown relative-link check: 22 Markdown files checked; zero missing relative targets;
- organisation memory lint: `records=89 errors=0 warnings=0 info=0`;
- installed signer checksum matched all pinned launchers.

## Repository state and commits

The completion sprint started at local commit `ca237ba` on branch `fix/testnet-run-once-resume`. Nothing was pushed or published.

New implementation and release-candidate commit: `d59ab717a8e9f88f1d03454144d92cc844c97d39` (`d59ab71`).

The previously untracked signer connection and preflight reports were inspected for private keys, passwords, tokens, PEM material, and secret assignments. No secret material was found, so they were added to version control together with the factory preflight report.

## Completed and verified

- Root v0.2.0 deployment and migration.
- Restricted v0.2.0 agent health and on-chain key policy.
- Both designated worker settlements and exact balance changes.
- Failed-transfer rollback, unauthorized, invalid-recipient, duplicate, insufficient-treasury, and forbidden-method behavior.
- Event-derived explorer links and archival/polling reliability fixes.
- Public factory blocker disclosure before wallet connection.
- Responsive and accessibility QA.
- 159-check repository gate and source-linked security evidence.
- Truthful live-v0.2 video release candidate and publication package.

## Completed but not published

- Final frontend guide, explorer reliability, factory disclosure, and generated evidence changes.
- Live-v0.2 caption-led video and QA artifacts.
- Local feature-branch commits and signer reports.

## Blocked by missing signer

- Factory code deployment and version verification.
- New factory-created v0.2 child and root/factory compatibility exercise.

The dependency is exactly the existing `factory.clavis.testnet` Full Access credential for fingerprint `11ced76408bc820a`. No replacement key or permission bypass is acceptable.

## Waiting for publication approval

- Push the feature branch and open or update the repository review.
- Publish the frontend revision through the existing production workflow.
- Upload the inspected video and update public release/submission links.

The prepared package is documented in `docs/reports/clavis-v02-publication-package-20261109.md`.

## Not tested

- A deliberately suppressed protocol callback on live Testnet. Deterministic contract tests cover stale-callback recovery, but no safe runtime mechanism was used to manufacture this abnormal condition.
- Mainnet. It was deliberately not touched.

## Non-blocking maintenance warnings

- Seventeen low-severity transitive `elliptic` advisories remain in the NEAR wallet dependency tree; the advertised automatic fix requires a breaking `near-api-js` upgrade.
- Vite reports large lazy wallet/provider chunks and vendor `eval` warnings.
- The live agent logs deprecation warnings for legacy `near-api-js` `Near` and `Connection` constructors.
- Two legacy factory children have no private payroll plans; the agent fails closed and logs `payroll.plan_missing`.

## Security and infrastructure preservation

- No private key, recovery phrase, keyring password, or full secret-bearing environment value was printed or committed.
- No account or access key was generated, replaced, added, deleted, or modified on-chain.
- The backend agent credential remains backend-only and separate from the owner/worker keychain.
- The Telegram bot, Telegram control plane, Local Bot API, shared Codex service, Video Studio, SSH configuration, and unrelated PM2 services were not modified.
- No Mainnet transaction or fund transfer occurred.
- No factory deployment transaction was submitted.

## Completion report

- **Requested:** Finish all safe Clavis engineering, resolve or precisely isolate the factory authority blocker, complete frontend/video integration, run final gates, commit clean reports, and update the acceptance report.
- **Implemented:** Factory authority audit and exact-key importer, public factory disclosure, sixth browser path, 159-check evidence, responsive/accessibility QA, live-v0.2 video candidate, publication package, and aligned documentation.
- **Tested:** Full repository gate, fresh read-only Testnet state/receipt checks, factory access keys and methods, agent health/key policy, 12 responsive captures, accessibility probes, and frame-level video QA.
- **Passed:** All safe independent engineering and verification work described above.
- **Failed:** No completed test produced an unexplained failure.
- **Incomplete:** Factory upgrade and external publication.
- **Not verified:** A new factory-created v0.2 child, a deliberately suppressed live callback, and Mainnet.
- **Risk:** The legacy factory remains unable to create v0.2 children until its exact existing signer is supplied. Root Full Access authority remains outside contract enforcement. Low-severity wallet advisories and deprecated NEAR client constructors remain documented maintenance work.
- **Next step:** Run `bash scripts/connect-factory-signer.sh` in trusted SSH with the exact factory credential, then review and execute the factory-only deployment phase. Separately approve repository/frontend/video publication.

## Scorecard evidence — no self-scores

| Criterion | Evidence |
| --- | --- |
| Engineering — correctness | Final receipts, events, exact balance deltas, rollback state, code hashes, and factory authority were checked against Testnet. |
| Engineering — tests | 31 payroll, 3 factory, 9 signer, 66 agent, 44 API/utility, and 6 browser checks pass. |
| Engineering — architecture | Contract-controlled settlement, restricted agent authority, two-phase reconciliation, archival RPC fallback, exact event mapping, and a fail-closed factory importer are documented and tested. |
| Design — visual quality | Twelve desktop/tablet/mobile release-candidate captures and individual video frames were visually inspected. |
| Design — responsiveness | Four routes at 390, 768, and 1440 pixels had one main landmark, one h1, no overflow, and no browser errors. |
| Design — usability | Setup discloses the legacy factory before wallet connection; loading, error, audit, and settlement boundaries remain explicit. |
| Branding — consistency | Existing Clavis visual language and terminology are consistent across the app, documentation, and live-v0.2 video. |
| Video — storytelling | The 93.7-second sequence moves from public promise to deployed truth, authority, settlement, reconciliation, privacy limits, evidence, and the remaining blocker. |
| Video — rendering | H.264 High 1080p/30 render, exact boundary frames, contact sheet, captions, and thresholded black-frame scan were inspected. |
| Research — accuracy | Installed CLI/help, live final RPC, transaction receipts, access keys, contract methods, PM2 state, and repository source were cross-checked. |
| Productivity — prioritisation | Existing successful transactions were revalidated rather than repeated; all work independent of the missing factory key was completed. |
| Memory — consistency | Organisation context was retrieved, linted, and will be superseded from this secret-free final report. |
