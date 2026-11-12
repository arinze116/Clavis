# Clavis NEAR Testnet wallet setup and transaction verification

> Historical evidence captured on 2026-11-09. Later v0.2 acceptance resolved several blockers recorded below; this report is not current deployment status.

Execution date: 2026-11-09

Host: `node1`, Africa/Lagos

Final verdict: **BLOCKED — REQUIRED CREDENTIAL OR INFRASTRUCTURE MISSING**

No private key, seed phrase, recovery phrase, wallet password, authentication token, cookie, or browser-storage value is included in this report.

## Completion summary

- **Requested:** Persistently install Meteor Wallet, import the existing owner and worker identities, verify the backend agent independently, execute real NEAR Testnet transactions, and prove the Clavis payroll workflow.
- **Implemented:** An isolated persistent Chromium profile; official Meteor Wallet installation; a safe launcher; backend-key cryptographic verification; restrictive credential permissions; real backend Testnet signing; on-chain transaction, policy, audit, balance, and explorer verification.
- **Tested:** Host and process state, browser persistence, extension state, NEAR RPC connectivity, all three accounts, agent signing, deployed contract state, policy denial, audit correlation, repository tests/builds, responsive UI, secret leakage, PM2 preservation, debugging ports, shell syntax, and Git whitespace.
- **Passed:** Meteor installation and browser-restart persistence; Testnet selection; backend identity and scoped permission checks; real agent transaction; fail-closed policy behavior; audit correlation; 132 repository tests; typechecks; builds; responsive checks; exact-secret scan; no unrelated service restart.
- **Failed:** No executed automated test failed. Full acceptance failed because the required existing owner and worker private keys were not present and the live v0.1 contract cannot settle payroll.
- **Incomplete:** Owner and worker imports, wallet password creation, account switching, owner-to-worker transfer, worker signing, owner mutation, live payroll settlement, duplicate-settlement proof, and end-to-end payment receipt.
- **Not verified:** Wrong-network UI with a populated wallet, user-rejected wallet prompts, VPS-restart persistence, and live v0.2 settlement/rollback.
- **Next step:** Make the existing, unchanged owner and worker keys available through a protected local credential source, then repeat import/signing tests. Full payroll proof also requires an explicitly approved upgrade of the deployed root/factory contracts to the already-tested v0.2 source. Do not generate replacement keys.

## Evidence labels

- **Verified:** Directly observed from the filesystem, running host, browser UI, NEAR RPC, transaction result, or executed test output.
- **Strongly supported:** Corroborated by official project/store sources and installed artefacts.
- **Unverified:** Could not be demonstrated with the available credentials or deployed implementation.

## A. Environment

### Host and deployment

| Item | Closing state | Evidence |
| --- | --- | --- |
| Working directory | `/home/ubuntu/Clavis1` | Verified with `pwd`/Git root inspection |
| VPS | Ubuntu aarch64, 2 Neoverse-N1 vCPUs, 11 GiB RAM, 8 GiB swap | Verified with `uname`, `lscpu`, and `free -h` |
| Disk | 145 GiB filesystem, 92 GiB available, 37% used | Verified with `df -h` |
| Source workspace | `/home/ubuntu/Clavis1` | Verified |
| Live Clavis agent | `/opt/clavis`, PM2 service `clavis-agent` v0.1.0, PID 395922, loopback `127.0.0.1:8787` | Verified at close; uptime remained about 43 hours |
| Legacy Clavis copy | `/home/ubuntu/clavis` | Verified; not used as the live runtime |
| Live frontend | `https://clavisapp.vercel.app` | Verified browser target; no deployment was performed |
| NEAR CLI | Executable absent; config file exists at `/home/ubuntu/.config/near-cli/config.toml` | Verified |
| Runtime libraries | Node.js 22.23.4, npm 10.9.9, `near-api-js` 6.5.1, Rust/Cargo 1.98.0 | Verified |

The standard NEAR CLI config contains both Mainnet and Testnet connection definitions, but no CLI transaction was executed. The application runtime and every transaction/query in this task used Testnet.

The repository started this wallet task on `fix/contract-controlled-settlement`. A concurrent external session changed the checkout during the task. The closing branch is `release/source-verified-closure` at `c28102f979c5`. This task did not switch branches or overwrite the concurrent changes.

### Browser and automation

| Item | Closing state |
| --- | --- |
| Browser executable | `/snap/bin/chromium` |
| Browser version | Chromium `157.0.8103.38` snap |
| Automation | Playwright `1.64.1` |
| Display | Existing XRDP X11 session, display `:10` |
| Session at close | Active and locked (`LockedHint=yes`) |
| Dedicated profile | `/home/ubuntu/snap/chromium/common/clavis-wallet-profile` |
| Profile ownership/mode | `ubuntu:ubuntu`, `0700` |
| Existing profile reuse | None; `/home/ubuntu/snap/chromium/common/chromium/Default` was not modified |
| Browser process at close | No process using the dedicated profile |
| Remote debugging | No Chromium/Chrome debugging listener; launcher has no debugging flag |

The extension and profile reopened after a Chromium restart. A VPS restart was not performed because it would disrupt unrelated production services. No existing browser automation service controlled this profile.

### Meteor Wallet

| Item | Result |
| --- | --- |
| Source | Chrome Web Store official listing: `https://chromewebstore.google.com/detail/meteor-wallet/pcndjhkinnkaohffealmlmhaepkpmgkb` |
| Store publisher | `Meteor Wallet` |
| Extension ID | `pcndjhkinnkaohffealmlmhaepkpmgkb` |
| Installed version | `0.8.12` |
| Store update date | 2026-11-09 |
| Installed manifest | Manifest v3, Google update URL, permissions `storage`, `alarms`, `idle` |
| Network | `TEST` shown in the Meteor UI |
| Persistence | Extension remained installed and opened after browser restart |
| Initialization | Deliberately uninitialized; no wallet password or replacement account was created |

The official Meteor website returned Cloudflare HTTP 403 from this VPS IP. The official Chrome Web Store listing was reachable, identified the same extension ID, publisher, and version, and the installed manifest uses Google's extension update service. The official NEAR wallet-selector Meteor module corroborates the extension integration. No CRX was obtained from a third-party mirror.

Evidence screenshots, all mode `0600`, are under `artifacts/ui/`, including:

- `meteor-wallet-testnet-uninitialized-20261109.png`
- `meteor-clavis-testnet-connect-blocked-20261109.png`
- `clavis-meteor-selector-20261109.png`

### Clavis architecture and network

- **Verified:** React/Vite/TypeScript frontend using `@near-wallet-selector/core` and `@near-wallet-selector/meteor-wallet` 10.1.4.
- **Verified:** TypeScript/Node backend agent under PM2, using a protected project-specific credential JSON file.
- **Verified:** Rust NEAR payroll and factory contracts.
- **Verified:** Live agent configuration sets `NEAR_NETWORK=testnet`, `VITE_NEAR_NETWORK=testnet`, root `clavis.testnet`, factory `factory.clavis.testnet`, and RPC `https://rpc.testnet.fastnear.com`.
- **Verified:** Independent account and transaction checks used `https://rpc.testnet.near.org`.
- **Verified:** The wallet selector is initialized with the configured Testnet network and exposes Meteor, MyNearWallet, and Sender adapters.
- **Unverified:** A populated-wallet Mainnet mismatch UI could not be exercised because the existing owner and worker keys were unavailable. No Mainnet signing or submission occurred.

## B. Account verification

Public-key fingerprints below are the first 16 hexadecimal characters of SHA-256 over the canonical public-key string. They are identifiers, not secret key material.

### Identity, credential, and signing status

| Account | Role | Exists | Public-key fingerprint | Access-key permission / nonce | Existing credential result | Signing capability | Separation result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `clavis.testnet` | Owner/business and root contract | Yes | `f04be2ff6ea611fc` | Full Access; nonce `275806257000033` | **Missing:** no matching private key located | **Unverified/blocked** | Not imported into Meteor because no verified key was available |
| `arinze-worker1.testnet` | Worker/payroll recipient | Yes | `e82216de9d1b57db` | Full Access; nonce `276013498000007` | **Missing:** no matching private key located | **Unverified/blocked** | Not imported into Meteor; independent from owner on-chain |
| `clavis-agent.testnet` | Backend-only agent | Yes | `3cd936add69d9567` | Function Call only; nonce `275829201000006`; receiver `clavis.testnet`; method `request_payment` | **Verified match** | **Verified** by real Testnet transaction | Present only in protected Clavis backend/legacy credential files; absent from browser targets |

The owner account has one Full Access key and seven additional Function Call keys. The table identifies the only owner Full Access key. A filename was never treated as proof of ownership.

The scoped credential search covered the Clavis workspaces and deployment, NEAR credential directories, Chromium profiles and extension storage, Downloads/Desktop/Documents, and the active GNOME secret-service collection. No owner or worker key was found. No replacement account or key was created.

The canonical live agent credential is `/opt/clavis/agent/config/agent-credentials.local.json`, mode `0600`, with one entry for `clavis-agent.testnet`. Its public key was derived in memory and matched the on-chain access key. The live `.env` refers to this file through `AGENT_CREDENTIALS_PATH`; it does not expose the private key to the frontend.

Two pre-existing legacy files, `/home/ubuntu/clavis/.env` and `/home/ubuntu/clavis/agent/.env`, contain the same agent key fingerprint. Their contents were not changed. Their modes were tightened from `0664` to `0600`. They remain a legacy duplication to retire only through a separately approved migration after confirming they are unused.

### Closing balances and storage

Closing public RPC checks were made around final blocks 276914525–276914545. The protocol storage amount was `10000000000000000000` yoctoNEAR per byte.

| Account | RPC amount | Locked | Storage usage | Storage-backed amount | Approx. amount above storage stake |
| --- | ---: | ---: | ---: | ---: | ---: |
| `clavis.testnet` | 9.9438773966421857 NEAR | 0 | 447,885 bytes | 4.47885 NEAR | 5.4650273966421857 NEAR |
| `arinze-worker1.testnet` | 1.9997073935375 NEAR | 0 | 182 bytes | 0.00182 NEAR | 1.9978873935375 NEAR |
| `clavis-agent.testnet` | 1.7980338344252179 NEAR | 0 | 240 bytes | 0.0024 NEAR | 1.7956338344252179 NEAR |

All three accounts had enough Testnet NEAR for the intended low-cost checks. Funds were not the blocker. The missing owner/worker credentials and deployed contract version were the blockers.

### Permission boundaries

- **Verified:** The agent key cannot call arbitrary accounts or methods; it is limited to `request_payment` on `clavis.testnet`.
- **Verified:** The agent key cannot sign for `clavis.clavis.testnet` because the access key receiver is fixed to `clavis.testnet`.
- **Verified:** Owner-only mutations are enforced by contract source and repository tests.
- **Unverified live:** The owner key's possession and the worker key's possession could not be demonstrated.
- **Verified:** `arinze-worker1.testnet` is not registered on the live root contract.
- **Verified:** The worker UI has no worker-signed on-chain mutation; it reads registration/audit state and stores preferences locally.

## C. Transactions

### Executed transaction: backend policy-denial proof

| Field | Evidence |
| --- | --- |
| Purpose | Prove that the backend loads the intended restricted key, signs on Testnet, reaches the deployed policy, and fails closed for an unapproved worker |
| Network/RPC | NEAR Testnet; independently verified with `https://rpc.testnet.near.org` |
| Transaction hash | `FbaBJgM6tbtxHbfutzSZwrhZkaBuHANwW6DVBuWPNgnG` |
| Signer | `clavis-agent.testnet` |
| Receiver | `clavis.testnet` |
| Method | `request_payment` |
| Intended recipient | SHA-256 commitment for `arinze-worker1.testnet` |
| Requested amount | 1 yoctoNEAR |
| Attached deposit | 0 NEAR |
| Gas attached | 100 Tgas |
| Gas used | 2.630768940852 Tgas |
| Total fee | 0.0002407586378352 NEAR |
| Inclusion | Height 276909984, hash `ed9b7HNyrb3bJTLR1ThUm1gHi4XUzPXGkNmdv5Zde8q` |
| Contract receipt | Height 276909985, hash `38apAqqmNcMYEM3sEPfjmGuEfTpRu2twkf8Cpyc1bE7U` |
| Final refund receipt | Height 276909986, hash `3t4bAp1L8xxjwurjri64XgyxJxXTfLiTyB22hr8YdqHz` |
| Execution status | NEAR execution succeeded; application decision was `approved: false`, payment ID 10, reason `Recipient not approved` |
| Audit evidence | `get_audit_log_reverse` entry 10 reports the same rejection at block 276909985 |
| Payment outcome | No transfer occurred; worker and contract balances were unchanged |
| Agent balance evidence | 1.7982745930630531 → 1.7980338344252179 NEAR; the exact delta equals the transaction fee |

Explorer evidence:

- `https://testnet.near.rocks/tx/FbaBJgM6tbtxHbfutzSZwrhZkaBuHANwW6DVBuWPNgnG` — HTTP 200 from the VPS.
- `https://explorer.testnet.near.org/transactions/FbaBJgM6tbtxHbfutzSZwrhZkaBuHANwW6DVBuWPNgnG` — official Testnet explorer selector, HTTP 200.

This is evidence of correct backend signing and policy denial. It is not evidence of a successful payroll payment.

### Required transactions not executed

| Operation | Status | Exact reason |
| --- | --- | --- |
| Owner-to-worker transfer, preferably 0.01 NEAR | Blocked | Existing `clavis.testnet` private key could not be located or cryptographically verified |
| Harmless worker-signed operation | Blocked | Existing worker private key was unavailable; current worker UI also has no worker-signed mutation |
| Owner policy/registration mutation | Blocked | Existing owner private key was unavailable |
| Agent-to-worker payroll settlement | Unsupported live | Deployed v0.1 `request_payment` records authorization decisions but does not perform contract-controlled native settlement |

## D. Clavis workflow

### Live deployment facts

- `clavis.testnet` reports contract version `0.1.0`, owner `clavis.testnet`, and agent `clavis-agent.testnet`.
- `clavis.clavis.testnet` reports version `0.1.0` with the same owner and agent.
- `factory.clavis.testnet` has no `contract_version` method. It reports root `clavis.testnet` and maps owner `clavis.testnet` to `clavis.clavis.testnet`.
- The root contract has three demo recipients, none matching `arinze-worker1.testnet`.
- Live policy is not paused; daily limit is 100 NEAR and per-payment limit is 20 NEAR.
- Workspace source v0.2 implements contract-controlled native settlement, but that source is not deployed to the live root/factory accounts.

### Workflow acceptance matrix

| Stage | Result | Evidence / limitation |
| --- | --- | --- |
| Meteor extension available to Clavis | Verified | Wallet-selector modal exposes Meteor; extension opens from the dedicated profile |
| Owner wallet connection | Blocked | No existing owner key available for import |
| Owner identity/balance in Meteor | Blocked | Meteor remains uninitialized rather than creating a replacement identity |
| Worker wallet connection | Blocked | No existing worker key available for import |
| Owner/worker account switching | Blocked | Neither account could be imported |
| Browser restart/reconnect | Partial | Extension/profile persisted; signed account reconnect could not be tested |
| Worker registration lookup | Verified | `is_registered(arinze-worker1.testnet)` returned `false` |
| Owner payroll policy confirmation | Read-only verified | Limits and pause state read on-chain; no owner mutation was signed |
| Policy validation | Verified | Real agent call rejected the unapproved worker |
| Approval | Correctly denied | No approval was fabricated or bypassed |
| Agent signing | Verified | Restricted key signed transaction `FbaBJ...PNgnG` |
| Payroll execution | Not supported live | v0.1 authorizes/records decisions but does not settle native NEAR |
| Worker payment receipt | Not performed | Policy denial and no settlement implementation |
| Audit record | Verified | On-chain audit entry 10 matches transaction result and block |
| Unauthorized payment protection | Verified on-chain | Unapproved worker produced a denial and no transfer |
| Worker cannot change owner policy | Verified in source/tests; live signing unverified | Contract methods assert owner; no worker key was available for an adversarial live signature |
| Agent cannot bypass policy | Verified for tested case | Scoped key reached the method, contract still denied the request |
| Duplicate-payment prevention | Local tests only | No live settlement exists, so duplicate transfer proof is impossible on v0.1 |
| Failed transaction not shown as payment success | Verified for this denial | Report and on-chain audit identify a rejection; no payment success is claimed |

### Wallet/UI state coverage

- **Verified:** Disconnected Clavis state, wallet selector open, Meteor extension available, Meteor `TEST` network, and “No Meteor Wallet account found” state.
- **Blocked:** Connected owner, connected worker, account mismatch, account switching, wallet transaction pending/success/rejection, and signed reconnect states.
- **Unverified:** Explicit wrong-network and RPC-unavailable UI with populated wallet state.

## E. Testing

### Repository verification

`./scripts/verify.sh` completed successfully before report closure. It ran:

- `cargo fmt --check --manifest-path contract/Cargo.toml`
- 28 payroll contract tests
- both release WASM builds
- 3 factory tests
- agent/frontend/API TypeScript checks
- 30 API tests
- 66 agent tests
- production frontend/agent/API builds
- demo typecheck
- 5 Playwright tests against the built application
- generated security-evidence freshness checks
- `npm audit --omit=dev --audit-level=moderate`
- `git diff --check`

Total repository tests passed: **132**. No executed test failed or was reported as skipped by the verification script.

The dependency audit reported 17 low-severity transitive `elliptic` findings and no moderate, high, or critical findings. The available forced remediation is breaking and was not applied.

### Browser and responsive verification

The live application was checked at desktop, tablet, and mobile widths. Captures include 1440 px, 768 px, and 390 px views plus a 390 px worker view. The checks found no horizontal overflow, duplicate main landmarks, or console errors. Screenshots are ignored by Git and mode `0600`.

Browser persistence was verified across a Chromium process restart. A VPS restart was deliberately skipped to preserve production services.

### Security and regression checks

| Check | Result |
| --- | --- |
| Canonical agent key derivation and on-chain match | Passed |
| Agent Function Call permission and nonce | Passed |
| Testnet RPC connectivity | Passed |
| Transaction finality, blocks, gas, fee, and audit correlation | Passed |
| Exact agent-private-key scan of browser profile, Git candidate files, frontend build, PM2 logs, and screenshots | 1,193 files / 309,207,344 bytes scanned; 0 matches |
| Generic private-key pattern scan of task-added documentation/launcher | 0 matches |
| Browser profile permissions | Passed: directory `0700`; manifest/preferences/state files `0600` |
| Public Chromium debugging port | None found |
| Dedicated-profile concurrency | No process using the profile at close |
| Launcher syntax | `bash -n` passed; executable bit present |
| Git whitespace | `git diff --check` passed |
| PM2 preservation | All pre-existing services remained online; no restart by this task |
| Graphical-session closure | Existing X11 session relocked |

### Tests skipped or blocked

- Owner import, signing, direct transfer, and owner-only mutations.
- Worker import, signing, registration, and account-switching proof.
- Wallet password creation and signed browser reconnect.
- Wrong-network, user-rejected connection, and user-rejected transaction UI.
- Live native payroll settlement, worker receipt, settlement callback, and duplicate settlement.
- VPS restart persistence.
- Contract/factory upgrade and production deployment.

## F. Changes and rollback

### Files added by this task

- `docs/adr/0002-meteor-wallet-profile-and-key-separation.md`
- `docs/reports/clavis-near-testnet-wallet-setup-20261109.md`
- `scripts/start-clavis-wallet-browser.sh`
- `/home/ubuntu/.local/state/clavis-wallet-setup/rollback-20261109.md`
- Restricted, Git-ignored screenshots under `artifacts/ui/*20261109.png`

Organisation memory was updated through `orgmem`: the prior Clavis project record was superseded by `prj-20261109-clavis-testnet-wallet-setup-blocked-after-meteor`, `PROJECT_INDEX.md` was pointed to the new record, the search index was rebuilt, and lint finished with 0 errors and 0 warnings. No secret material was recorded.

### Existing files modified by this task

Only filesystem modes changed; contents were not changed:

| Path | Before | After |
| --- | ---: | ---: |
| `/home/ubuntu/clavis/.env` | `0664` | `0600` |
| `/home/ubuntu/clavis/agent/.env` | `0664` | `0600` |

The live files `/opt/clavis/agent/.env` and `/opt/clavis/agent/config/agent-credentials.local.json` remained mode `0600` and were not rewritten.

### Browser profile changes

- Created `/home/ubuntu/snap/chromium/common/clavis-wallet-profile` with mode `0700`.
- Installed Meteor Wallet `0.8.12` from the Chrome Web Store.
- Selected/verified the `TEST` network.
- Did not create an account, seed phrase, password, or wallet identity.
- Did not import the backend agent.
- Added a launcher that contains no password/private key and exposes no debugging port.

### Packages, variables, and services

- System/npm packages installed or updated: **none**.
- Environment variables added or changed: **none**.
- Services started/stopped/restarted: **none**. Only transient Chromium processes for the dedicated profile were opened and closed.
- Contracts deployed/upgraded: **none**.
- Accounts/keys created, rotated, removed, or revoked: **none**.
- Nginx, DNS, firewall, SSH, Telegram, Codex App Server, PM2 definitions, databases, and Video Studio: **unchanged**.

### Concurrent worktree state

At close, another session had modified or added files outside this wallet task:

- Modified: `demo/narration/clavis-hackathon.txt`, `demo/remotion/src/ClavisDemo.tsx`, `demo/remotion/src/types.ts`, `docs/generated/security-report.json`, `docs/generated/security-report.md`, `package.json`.
- Untracked: `scripts/capture-source-demo.ts`, `scripts/prepare-source-demo.ts`.

Those changes were preserved and are not attributed to this task. The ADR, report directory, and wallet launcher are also untracked pending owner review. No commit or push was made.

### Rollback

1. Confirm no Chromium process uses `--user-data-dir=/home/ubuntu/snap/chromium/common/clavis-wallet-profile`.
2. Move the dedicated profile to a private timestamped sibling path. Do not delete it or touch the existing Chromium `Default` profile.
3. Move the launcher and task documentation aside if repository rollback is required.
4. The prior `.env` modes are recorded in `/home/ubuntu/.local/state/clavis-wallet-setup/rollback-20261109.md`. Restoring `0664` is not recommended; do it only if the broader group-read permission was intentionally required.
5. No service, contract, access key, account, firewall, DNS, Nginx, or package rollback is required.

No private-key backup archive was created. Original credential files were not deleted or overwritten.

## Security acceptance

| Requirement | Result |
| --- | --- |
| Only NEAR Testnet used | **Verified** |
| Existing account identities preserved | **Verified** |
| No new/replacement accounts or keys | **Verified** |
| Owner key matches intended account | **Unverified — key missing** |
| Worker key matches intended account | **Unverified — key missing** |
| Backend key matches `clavis-agent.testnet` | **Verified** |
| Backend agent not imported into Meteor | **Verified** |
| Backend private key unavailable to frontend/browser | **Verified within scoped profile/build/API inspection and exact-secret scan** |
| No private key/seed in logs | **Verified for the known agent key; no seed phrase was generated** |
| No private key/seed in screenshots | **Verified; secret inputs were never populated and exact-key scan found no match** |
| No secrets added to Git | **Known agent key absent from Git candidate files; task-added files passed a generic key-pattern scan. Concurrent unrelated edits were not exhaustively classified for every secret type.** |
| No secrets in frontend build | **Verified for the known agent key** |
| Wallet profile permissions restrictive | **Verified** |
| No public remote debugging port | **Verified** |
| Owner/worker permission boundary | **Verified in source/tests; live owner/worker signing unverified** |
| Payroll approval/policy checks intact | **Verified for unapproved-recipient denial; full settlement unavailable live** |
| No unrelated production service modified | **Verified** |

## Source ledger and confidence

Accessed 2026-11-09:

- **Verified:** Local host/process/filesystem, installed extension manifest, profile metadata, PM2 state, ports, repository source/tests, and screenshots.
- **Verified:** `https://rpc.testnet.near.org` account, key, block, protocol, contract-view, audit, and transaction responses.
- **Verified:** `https://chromewebstore.google.com/detail/meteor-wallet/pcndjhkinnkaohffealmlmhaepkpmgkb` — title, extension ID, version 0.8.12, update date, and publisher `Meteor Wallet`.
- **Verified:** `https://clients2.google.com/service/update2/crx` — installed manifest update service.
- **Strongly supported:** `https://github.com/Meteor-Wallet/meteor-public` and `https://github.com/near/wallet-selector/tree/main/packages/meteor-wallet` — official integration/Testnet guidance.
- **Verified:** `https://docs.near.org/` and official Testnet RPC behavior.
- **Verified:** Explorer transaction pages listed in section C returned HTTP 200 from the VPS.
- **Unverified:** Meteor's marketing website content because `https://meteorwallet.app/` returned Cloudflare HTTP 403 from this IP.

## Scorecard evidence — no self-scores

| Area / criterion | Evidence |
| --- | --- |
| Engineering — correctness | Keys were derived locally, compared to on-chain access keys, and the agent result was checked through final receipts and audit state. Blocked operations failed closed. |
| Engineering — tests | 132 repository tests, typechecks, builds, WASMs, browser checks, RPC checks, secret scan, and diff checks completed. |
| Engineering — architecture | ADR 0002 records isolated browser custody and backend-only scoped signing. No new signing architecture or dependency was introduced. |
| Design — visual quality | Desktop/tablet/mobile and wallet-state screenshots were reviewed; no visual acceptance score is claimed. |
| Design — responsiveness | 1440, 768, and 390 px checks found no horizontal overflow or duplicate main landmark. |
| Design — usability | Disconnected, selector, extension-available, Testnet, and missing-account states were observed. Signed flows remain blocked. |
| Branding — originality/recognisability/consistency | Not evaluated by this infrastructure task; no branding claim is made. |
| Video — storytelling/motion/audio/rendering | Out of scope and not evaluated. |
| Research — accuracy | Official store/source references were cross-checked against installed artefacts and direct RPC evidence. |
| Research — evidence | Transaction hash, blocks, fee, balances, key permissions, audit entry, screenshots, commands, and file modes are recorded. |
| Research — novelty | Not applicable; no novelty claim is made. |
| Productivity — prioritisation | Inspection preceded installation; independent backend proof proceeded while browser-key work remained blocked. |
| Productivity — reliability | Additive changes, restrictive permissions, explicit rollback metadata, and no unrelated service restart reduced operational risk. |
| Memory — retrieval/accuracy | Organisation memory and the existing Clavis v0.2 verification record were retrieved before closure and checked against live v0.1 RPC state. |
| Memory — retention/consistency | `prj-20261109-clavis-testnet-wallet-setup-blocked-after-meteor` supersedes the stale Clavis project record, is sourced from this report, excludes secrets, and passes `orgmem lint` with 0 errors/warnings. |

## G. Final verdict

**BLOCKED — REQUIRED CREDENTIAL OR INFRASTRUCTURE MISSING**

Meteor Wallet and the dedicated profile are installed correctly, persist across browser restarts, and are explicitly on Testnet. The backend independently signs as `clavis-agent.testnet`, and a real transaction proved the deployed policy denies an unapproved worker without transferring funds. Full acceptance is impossible because the existing owner and worker keys could not be located and the live v0.1 deployment cannot execute contract-controlled payroll settlement.
