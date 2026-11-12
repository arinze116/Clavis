# Clavis v0.2 final Testnet acceptance

> Historical v0.2 acceptance captured on 2026-11-10. It remains valid evidence for that deployment but does not describe source v0.3 or a future v0.3 deployment.

Acceptance date: 2026-11-10

Workspace: `/home/ubuntu/Clavis1`

Network: NEAR Testnet only

## Final verdict

**COMPLETE — CLAVIS V0.2 END-TO-END TESTNET VERIFIED**

Verified: the recovered `factory.clavis.testnet` signer matches the sole on-chain FullAccess authority with fingerprint `11ced76408bc820a`. The factory was upgraded to the reviewed v0.2.0 WASM, its legacy registry was preserved, and its access keys remain unchanged.

Verified: the factory created the dedicated acceptance child `clavis-v02-e2e-20261110.clavis.testnet`. The child runs the reviewed root v0.2.0 code, has the expected owner and agent, emitted the expected registration event, completed a native NEAR settlement, and passed the required authorization and failure paths.

Verified: the root, factory, production backend agent, and local production frontend all use the intended Testnet addresses and v0.2 interfaces. The complete repository gate passed with 170 tests and browser paths. Nothing was pushed, published, or deployed to Mainnet.

## Evidence labels

- **Verified:** directly observed in final Testnet RPC state, final transaction receipts, repository source, build output, service health, or browser automation.
- **Strongly supported:** multiple verified records agree, but the evidence is historical rather than newly submitted in this acceptance pass.
- **Not verified:** deliberately outside the authorised Testnet and local-publication boundary.

## Deployment inventory

| Component | Account | Version | NEAR code hash | Downloaded/local SHA-256 |
| --- | --- | --- | --- | --- |
| Root payroll | `clavis.testnet` | `0.2.0` | `QzVUeXbKBPLMM14dDoLWCY8AKdSqJqeGxhGL3raM6bk` | `06255d262d74c07b1d95be12f711a451a1a2abe5c30b7344d2ee1d97ab28fe63` |
| Factory | `factory.clavis.testnet` | `0.2.0` | `HaSfbupBYJ77gJ1Dw3JXdztTBUZ7Du1xw2kMU6upmG1E` | `f64c2d7a8b9ce47c5922c6beb65ac8c579110f6286f2b7aa4b26559b72f7bf39` |
| Acceptance child | `clavis-v02-e2e-20261110.clavis.testnet` | `0.2.0` | `QzVUeXbKBPLMM14dDoLWCY8AKdSqJqeGxhGL3raM6bk` | `06255d262d74c07b1d95be12f711a451a1a2abe5c30b7344d2ee1d97ab28fe63` |

The root upgrade and migration transaction remains [`7DACvFhKgtGrrGENKAoZk23uHjMmRtP6wXotRFHTKqWA`](https://testnet.nearblocks.io/txns/7DACvFhKgtGrrGENKAoZk23uHjMmRtP6wXotRFHTKqWA). Fresh RPC verification returned root version `0.2.0`, owner `clavis.testnet`, agent `clavis-agent.testnet`, and no pending native-payment recovery.

## Factory signer and pre-upgrade state

The secure recovery workflow verified all four existing signers without printing or exporting credentials:

| Account | Fingerprint | On-chain permission | Result |
| --- | --- | --- | --- |
| `clavis.testnet` | `f04be2ff6ea611fc` | FullAccess | Verified |
| `arinze-worker1.testnet` | `e82216de9d1b57db` | FullAccess | Verified |
| `arinze-worker2.testnet` | `375920a41f22718d` | FullAccess | Verified |
| `factory.clavis.testnet` | `11ced76408bc820a` | FullAccess | Verified |

The private rollback baseline is `/home/ubuntu/.local/state/clavis-v02-20261110-factory-final/baseline.json`, mode `0600`. It captured the root and factory code, access keys, registry, root policy and audit state, public account balances, and preservation hashes for protected backend files before the factory transaction.

Pre-upgrade factory state:

- legacy NEAR code hash: `DgajXyTxZbvwDznWM8udMDU5L3kDoAgqUHFDSzWKodsW`;
- `contract_version` unavailable;
- root account: `clavis.testnet`;
- two registered children: `e2e-20261103.clavis.testnet` and `clavis.clavis.testnet`;
- one FullAccess key, public-key fingerprint `11ced76408bc820a`;
- dedicated acceptance child and negative-path account IDs absent.

This proves the previous blocked attempt had not partially installed the v0.2 factory or created the acceptance child.

## Factory upgrade

Factory upgrade transaction: [`9RjGMTzWMCbPzndsSZQVw935UQRe8qGZYATCzEH9Kdce`](https://testnet.nearblocks.io/txns/9RjGMTzWMCbPzndsSZQVw935UQRe8qGZYATCzEH9Kdce)

Final receipt verification established:

- signer and receiver were both `factory.clavis.testnet`;
- final execution status was `FINAL` with success;
- the transaction contained exactly one `DeployContract` action;
- deployed bytes SHA-256 matched `f64c2d7a8b9ce47c5922c6beb65ac8c579110f6286f2b7aa4b26559b72f7bf39`;
- live `contract_version` returned `0.2.0`;
- live registry preserved the two baseline records exactly;
- the sole factory FullAccess key remained unchanged.

No factory migration call was applicable. The legacy and v0.2 factory use the same Borsh state layout; v0.2 adds version reporting and embeds the reviewed root v0.2 WASM. The code-only deployment preserved state, and the pre/post registry comparison is the migration-equivalent evidence.

## New-child acceptance

Dedicated Testnet child: `clavis-v02-e2e-20261110.clavis.testnet`

Creation transaction: [`DnchBkKvWex7VWwmz5qE2aXDdDoYSzcq9BaoXC9kq1qr`](https://testnet.nearblocks.io/txns/DnchBkKvWex7VWwmz5qE2aXDdDoYSzcq9BaoXC9kq1qr)

Verified postconditions:

- returned account ID and `clavis_factory/payroll_created` event both identify the dedicated child;
- factory registry appended exactly one record without modifying the two legacy records;
- owner is `arinze-worker2.testnet`;
- agent is `arinze-worker1.testnet`;
- child contract account has no access keys;
- version is `0.2.0`, code hash matches the reviewed root, and limits are restored to 1 NEAR daily / 0.1 NEAR per payment;
- one active Weekly recipient remains after cleanup;
- no pending payment recovery remains.

Factory rejection evidence:

| Scenario | Transaction | Verified result |
| --- | --- | --- |
| Invalid business name | [`HMkBYjpqtkEUFWdD6AB4KrmevYY7L4SWiwqp4t1aJsdo`](https://testnet.nearblocks.io/txns/HMkBYjpqtkEUFWdD6AB4KrmevYY7L4SWiwqp4t1aJsdo) | Rejected before account creation |
| Deposit below 6 NEAR | [`7n49PL5xi4Z24d59NWVnn71MrvkeV8mMsRJd267J7Ro7`](https://testnet.nearblocks.io/txns/7n49PL5xi4Z24d59NWVnn71MrvkeV8mMsRJd267J7Ro7) | Rejected; low-deposit child absent |
| Signer does not equal requested owner | [`8g9sBpqSxT1dMxhdeE54QFp8Ch1SxyVG8zwh3xHEytRS`](https://testnet.nearblocks.io/txns/8g9sBpqSxT1dMxhdeE54QFp8Ch1SxyVG8zwh3xHEytRS) | Rejected `The owner must submit the deployment` |
| Agent attempts owner mutation | [`Aj3diV8NUAxbcEo8h6nhbrnrbY9nT2e6DnMzaCBosrBN`](https://testnet.nearblocks.io/txns/Aj3diV8NUAxbcEo8h6nhbrnrbY9nT2e6DnMzaCBosrBN) | Rejected `Owner authorization required`; policy unchanged |

## Payroll and failure paths

Historical root payroll transactions were revalidated and remain successful:

| Worker | Amount | Transaction | Captured exact balance change |
| --- | ---: | --- | ---: |
| `arinze-worker1.testnet` | 0.01 NEAR | [`VjihUv5t54rEz177Eg1nYXogJw77mNxktnqyBYY2DLg`](https://testnet.nearblocks.io/txns/VjihUv5t54rEz177Eg1nYXogJw77mNxktnqyBYY2DLg) | +0.01 NEAR |
| `arinze-worker2.testnet` | 0.01 NEAR | [`CxK3vuAUv5bPooeuWafnvzpU2SryJY142keyw3knYoht`](https://testnet.nearblocks.io/txns/CxK3vuAUv5bPooeuWafnvzpU2SryJY142keyw3knYoht) | +0.01 NEAR |

New-child settlement:

- transaction: [`2YidaCUj1NGSbpF1HH3nmE6FJzSB8YN63Yzd8XQoALHw`](https://testnet.nearblocks.io/txns/2YidaCUj1NGSbpF1HH3nmE6FJzSB8YN63Yzd8XQoALHw);
- amount: 0.001 NEAR;
- recipient: `arinze-worker2.testnet`;
- captured recipient balance: `3.9842615666832728` NEAR before and `3.9852615666832728` NEAR after, exact `+0.001` NEAR;
- captured child balance: 6 NEAR before and 5.999 NEAR after, exact `-0.001` NEAR;
- `payment_decision` event and audit entry report Approved and settled.

New-child failure evidence:

| Scenario | Transaction | Verified result |
| --- | --- | --- |
| Duplicate scheduled settlement | [`APC9h3NEePcAMg6hQjTLYrjeKu4XGm43bsiq8RuYzB1g`](https://testnet.nearblocks.io/txns/APC9h3NEePcAMg6hQjTLYrjeKu4XGm43bsiq8RuYzB1g) | Rejected `Payment is not due`; no duplicate transfer |
| Transfer to missing account | [`Gb5ojaMy2i9S5i5Fz1D7Sd52icjR1u9HSeDYWNbid5wN`](https://testnet.nearblocks.io/txns/Gb5ojaMy2i9S5i5Fz1D7Sd52icjR1u9HSeDYWNbid5wN) | Rejected `Native NEAR transfer failed`; spend and schedule rolled back |
| Insufficient treasury | [`6r2d5hZ3dF797Ke85iMQEUTd2ZzJKP39jP7dsZyE7Jjk`](https://testnet.nearblocks.io/txns/6r2d5hZ3dF797Ke85iMQEUTd2ZzJKP39jP7dsZyE7Jjk) | Rejected `Insufficient contract treasury balance`; no false settlement |

Temporary failure-probe recipient and temporary high limits/cap/schedule were removed or restored. Final live state has one recipient, original limits, 0.001 NEAR daily spend, four audit entries, and no pending recovery.

## Existing-child and root regression

The acceptance script captured both legacy children before the upgrade and compared their full available public payroll snapshots after all factory and child operations. Both remained byte-for-byte equal at the view-model level. The root snapshot also remained unchanged throughout the factory workflow.

The read-only replay command re-fetched the factory deploy receipt and all 18 acceptance transactions at finality, verified exact signers, receivers, methods, arguments, deposits, expected success/failure results, events, deployed code, preserved state, and live final state without submitting a transaction:

```bash
NEAR_RPC_URL=https://near-testnet.drpc.org \
CLAVIS_BASELINE_DIRECTORY=/home/ubuntu/.local/state/clavis-v02-20261110-factory-final \
node --import tsx scripts/factory-v02-testnet-acceptance.ts verify
```

## Backend agent integration

| Check | Verified result |
| --- | --- |
| PM2 service | `clavis-agent`, online, application version `0.2.0` |
| Health | `http://127.0.0.1:8787/health` returned `{"ok":true}` |
| Network | `NEAR_NETWORK=testnet` |
| RPC | `https://test.rpc.fastnear.com` |
| Factory address | `factory.clavis.testnet` |
| Root admission | live root agent is `clavis-agent.testnet` |
| On-chain agent key | FunctionCall only; receiver `clavis.testnet`; method list `request_payment` |
| Source parity | production `agent/src/index.ts` SHA-256 matches the reviewed workspace source |

No Clavis service restart was required. No unrelated service was modified.

## Frontend integration and visual acceptance

The production frontend build passed and the `/setup` route fetched the live factory version through the configured Testnet RPC proxy. It displayed: `Factory v0.2.0 creates contracts with contract-controlled native NEAR settlement.`

Fresh screenshots and audits are under `artifacts/acceptance/clavis-v02-20261110/ui/` for widths 320, 375, 768, 1024, and 1440 pixels. Every viewport had:

- one `main` and one `h1`;
- zero horizontal overflow;
- zero browser or page errors;
- `lang="en"`, 16px body text, and the skip link as first keyboard focus;
- zero unnamed visible buttons, images missing `alt`, or visible interactive targets below 44×44 pixels.

Desktop, tablet, and mobile captures were visually inspected. The active factory status, hierarchy, form card, navigation, footer, spacing, and responsive wrapping remained readable and aligned.

## Automated verification

Primary command:

```bash
bash scripts/verify.sh
```

| Suite | Passed |
| --- | ---: |
| Payroll contract | 31 |
| Factory contract | 3 |
| Secure signer tool | 12 |
| Agent Vitest | 66 |
| API and utility Node tests | 50 |
| Playwright browser paths | 8 |
| **Total** | **170** |

The same gate passed Rust formatting, signer Clippy with warnings denied, both WASM builds, TypeScript/Testnet/demo typechecks, agent and frontend production builds, generated security-evidence freshness, production dependency audit at the configured threshold, deployment-script syntax, and `git diff --check`.

Non-blocking warnings remain unchanged: 17 low-severity transitive `elliptic` advisories in the NEAR wallet stack, large Vite wallet/provider chunks, vendor `eval` warnings, and legacy `near-api-js` constructor deprecations in the production agent.

## Repository audit and local commits

All repository changes since `ca237ba` were reviewed through the rebased feature history, full verification gate, generated-evidence check, and a tracked/untracked credential-pattern scan. The scan covered 85 changed files and found zero private keys, seed phrases, PEM private keys, passwords, API-token assignments, or common hosted-service token formats.

The signer recovery and connection reports contain only public account IDs, public keys/fingerprints, file metadata, hashes, and verification outcomes. They are safe to commit.

Relevant local commits after rebasing onto `origin/main`:

| Commit | Purpose |
| --- | --- |
| `8e11681` | Safe Testnet payroll acceptance resume |
| `5ccff4d` | Live v0.2 evidence and explorer reliability |
| `a8b88fd` | Final v0.2 release-candidate implementation |
| `df7b70c` | Historical full-execution report finalization |
| `09ba1d5` | Factory signer recovery and verification |
| `16291eb` | Factory v0.2 upgrade/child acceptance workflow and evidence checks |
| `499a668` | Final acceptance report, active documentation alignment, and regenerated security evidence |

No commit was pushed and no pull request, frontend publication, or video publication was created.

## Outstanding publication work

The following remain behind the existing publication approval gate:

- push `feat/clavis-brand-refresh`;
- open or update the GitHub pull request;
- publish the frontend through the approved production workflow;
- update or publish external release/demo assets and links.

Mainnet was not touched and remains out of scope.

## Completion report

- **Requested:** Resume the blocked factory phase, upgrade the factory, create and exercise a new child, run the full regression and integration gates, audit changes, commit locally, and produce final evidence.
- **Implemented:** Secure factory recovery, state-compatible factory v0.2 deployment, dedicated child acceptance, exact finality/receipt replay, negative and rollback paths, responsive/accessibility capture, repository audit, and local feature-branch commits.
- **Tested:** Live Testnet code/state/access keys, 19 factory/child transaction receipts including the upgrade, root and existing-child preservation, agent health/key policy, 170 repository tests and browser paths, five responsive viewports, builds, audit, typechecks, script syntax, and secret-pattern scanning.
- **Passed:** Every required Testnet deployment, child, regression, integration, build, and local repository gate.
- **Failed:** No acceptance requirement failed.
- **Incomplete:** External publication only; it was not authorised.
- **Not verified:** Mainnet and intentionally manufactured protocol-level callback suppression.
- **Risk:** The documented low-severity wallet dependency advisories and bundle/deprecation maintenance warnings remain. Factory-account upgrade authority still depends on preserving its dedicated secure keyring.
- **Next step:** Obtain publication approval before pushing, opening a PR, publishing the frontend, or publishing release media.

## Scorecard evidence — no self-scores

| Criterion | Evidence |
| --- | --- |
| Engineering — correctness | Final receipts, exact action bytes, versions, code hashes, access keys, registry preservation, events, balance deltas, rollback state, and live final state were verified. |
| Engineering — tests | 170 contract, signer, agent, API/utility, and browser checks passed; the live evidence replay verified all recorded factory/child transactions without resubmission. |
| Engineering — architecture | Root-only child provisioning, factory-owned registry, embedded reviewed WASM, restricted agent authority, contract-controlled settlement, and resume-safe evidence are documented and exercised. |
| Design — visual quality | Desktop, tablet, and mobile setup captures were inspected after the live factory became active. |
| Design — responsiveness | Five required widths had no overflow or browser errors and preserved the intended hierarchy and layout. |
| Design — usability | The setup route reports active v0.2 capability before wallet connection and retains clear wallet, progress, loading, success, and failure boundaries. |
| Branding — consistency | The merged Keygate identity and refined footer remain consistent across the live-status setup captures and production build. |
| Video | No new video was rendered in this factory-only completion; existing publication remains gated. |
| Research — accuracy | Live RPC, final receipts, installed CLI help/version, repository history, service health, public configuration, and browser output were cross-checked. |
| Productivity — prioritisation | Existing final transactions were replayed rather than duplicated; only missing evidence and integration gates were added. |
| Memory — consistency | Organisation context was retrieved first; the durable completion update contains no credential material. |

## Evidence locations

- `/home/ubuntu/.local/state/clavis-v02-20261110-factory-final/baseline.json`
- `/home/ubuntu/.local/state/clavis-v02-20261110-factory-final/execution/factory-v02-acceptance.json`
- `/home/ubuntu/.local/state/clavis-v02-20261110-factory-final/execution/`
- `artifacts/acceptance/clavis-v02-20261110/ui/`
- `docs/reports/clavis-near-factory-signer-recovery-20261109.md`
- `docs/reports/clavis-near-factory-signer-connection-20261110.md`
