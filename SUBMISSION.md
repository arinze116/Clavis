# Clavis submission package

## Release status

Do not submit until every item in the final checklist is checked. In particular, the production NEAR AI key and live `/api/ai` verification are external release gates, not optional polish.

## Submission fields

**Project name**
Clavis

**Tagline**
Private, rule-bound cross-chain payroll for autonomous agents on NEAR.

**One sentence**
Clavis lets an AI payroll agent schedule work while an isolated Rust contract enforces recipients, caps, schedules, routes, emergency controls, and a privacy-safe public audit.

**Short pitch**
Payroll automation creates a dangerous tradeoff: the more useful an agent becomes, the more treasury authority it usually receives. Clavis breaks that link. Owners configure payroll in the browser, use NEAR AI to draft and understand policy, and deploy an isolated NEAR contract that independently approves or rejects every request. Workers receive on their preferred route, while the public audit proves decisions without publishing recipient identities or amounts.

**Full description**
Clavis is a NEAR testnet payroll control plane for remote teams. A business owner deploys an isolated contract, defines global and per-recipient limits, approves destination routes, configures a private scheduled amount, and appoints an agent account. The TypeScript scheduler checks due work every 60 seconds, but the Rust contract remains the authority for pause state, caller identity, recipient approval, active status, off-hours policy, per-payment limits, personal caps, daily limits, schedules, and routes.

NEAR AI is visible at the decision points where language helps: it converts plain-English policy into an editable draft, explains anomalies, recommends a testnet route from live RPC observations, and produces a CFO-style report from privacy-safe audit data. In Emergency Controls, AI describes five canonical attacks and the contract independently proves whether each one is blocked. The UI accepts success only when it can verify five structured on-chain results.

Sensitive delivery configuration is signed by the owner in the browser and stored in the private agent service rather than in the public audit log. Approved work is prepared for a NEAR Intents settlement adapter. The current hackathon deployment is testnet-only and keeps the Intents relay in dry-run mode; completed cross-chain settlement is not claimed.

## Problem

Remote teams want programmable payroll, but a conventional payroll bot often holds enough authority to pay the wrong person, exceed a limit, run at the wrong time, or hide what happened. Existing automation also forces an uncomfortable choice between public transparency and exposing sensitive payroll details.

## Solution

Clavis separates four responsibilities:

```text
Owner browser
  ├─ wallet-signed public policy ───────► isolated NEAR payroll contract
  └─ wallet-signed private plan ────────► private agent service
                                                │
60-second scheduler ── request_payment only ────┤
                                                ▼
                                      contract rules + public audit
                                                │
                                                ▼
                                      NEAR Intents adapter / worker route
```

AI proposes and explains. The owner confirms. The contract decides.

## Why NEAR

- **Rust contracts:** deterministic rules and owner-only emergency controls.
- **Account model and access keys:** support for an agent key restricted to `request_payment` on one receiver; the shared multi-contract testnet operator must be disclosed separately if it uses an explicitly allowed full-access credential.
- **Factory architecture:** one isolated `*.clavis.testnet` contract per business.
- **Fast testnet UX:** wallet-signed setup and policy updates from the browser.
- **NEAR Intents:** a settlement abstraction for worker-selected routes after contract approval.
- **Public verification:** NearBlocks links connect UI decisions to testnet transactions.

## NEAR AI usage

Server-side endpoint: `https://cloud-api.near.ai/v1/chat/completions`

Model: `meta-llama/Llama-3.3-70B-Instruct`

Implemented tasks:

1. Plain-English policy extraction into limits, schedule, recipient caps, summary, and warnings.
2. Cautious anomaly explanation with a recommended owner action.
3. CFO-style report from the latest thirty public-safe audit entries.
4. Testnet route recommendation enriched with point-in-time NEAR, Sepolia, and BNB RPC observations.
5. Human-readable descriptions of five canonical security scenarios before the contract evaluates them.

The API key stays in the Vercel serverless environment. Browser code calls same-origin `/api/ai` and never imports the secret.

## Strongest differentiators

- **AI is not the authority.** It assists with language; deterministic contract code controls funds.
- **The security demo produces proof.** Five scenarios are evaluated on-chain and written to the public audit log without moving funds.
- **Private and public state are deliberately separated.** Scheduled amounts and destination addresses live in an owner-authorized private plan; public audit entries contain decision evidence rather than payroll identities or amounts.
- **Every owner workflow is browser-accessible.** Setup, recipient CRUD, private plan sync, limits, agent updates, pause, emergency withdrawal, notification linking, security audit, reports, and documentation do not require a user terminal.

## Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Payroll contract | Rust, NEAR SDK | Rules, treasury controls, recipients, audit, anomalies, security probes |
| Factory/root | Rust, NEAR promises | Isolated business-account deployment and owner registry |
| Agent | TypeScript, Node.js, PM2 | 60-second scheduling, anomaly processing, private plans, intent construction, notifications |
| Private browser bridge | Vercel function + restricted SSH forward | Relays signed plan and notification requests without exposing service credentials |
| AI proxy | Vercel function | Validates, rate-limits, and sends task-specific prompts to NEAR AI Cloud |
| Frontend | React, TypeScript, Vite | Owner, worker, audit, setup, guide, wallet and transaction UX |

## Live links

- App: https://clavisapp.vercel.app
- Repository: https://github.com/arinze116/Clavis
- Root contract: https://testnet.nearblocks.io/address/clavis.testnet
- Factory contract: https://testnet.nearblocks.io/address/factory.clavis.testnet
- Public audit: https://clavisapp.vercel.app/audit
- Guide: https://clavisapp.vercel.app/guide
- Demo video: **[add final video URL]**
- Security-audit transaction: https://testnet.nearblocks.io/txns/Ng3cFYga534jZJJoFeAuzDgH5xLrMXP9Yrg52gkT4rc

## Track fit

| Track | Fit |
| --- | --- |
| Agents | Autonomous scheduling with a deliberately narrow contract role and human-readable AI assistance |
| Security | Fail-closed policy engine, owner-only controls, pause/withdraw, anomaly handling, and observable five-scenario audit |
| Privacy | Private delivery plan plus privacy-safe public audit, with standard-NEAR argument limitations disclosed |
| Real-world | Payroll operations, worker portal, notifications, reports, and recovery controls |
| Business | Isolated contracts per business, CFO summary, roster management, and clear operating documentation |

## Verified evidence

Run this exact gate after the final integration commit:

```bash
bash scripts/verify.sh
git diff --check
```

Most recent component evidence before final release:

- Agent tests: `31/31` passing.
- Contract tests: `21/21` passing.
- Factory tests: `3/3` passing.
- Frontend, agent, and API TypeScript checks pass.
- Production frontend build and both release WASM builds pass.
- Desktop and 375px route smoke found no horizontal overflow or console errors.
- Root and factory testnet code matched the locally built release WASM when checked.
- Live security audit transaction `Ng3cFYga534jZJJoFeAuzDgH5xLrMXP9Yrg52gkT4rc` returned five blocked results and wrote payment IDs 5–9.
- Production dependency audit has no moderate, high, or critical findings. It reports 17 low-severity transitive `elliptic` advisories in the NEAR wallet stack; the available forced remediation is a breaking dependency upgrade and is documented rather than applied blindly.

Replace this section with the final command timestamp and commit SHA before submission.

## Honest disclosures

- Clavis is **NEAR testnet only**.
- The current NEAR Intents integration is configured in **dry-run mode**. Route policy and intent construction are implemented; completed cross-chain settlement is not claimed.
- The public audit omits recipient identities and amounts. Standard NEAR function-call arguments are still public; complete transaction-input confidentiality requires the documented confidential-executor boundary.
- AI output is advisory. Owners can edit generated policy, and the contract—not the model—makes authorization decisions.
- Route advice is a point-in-time testnet recommendation. RPC latency is not settlement time, and gas-unit values are not compared directly across chains.
- Existing child contracts must run the release WASM before they can expose new contract methods. The root and factory release state must be rechecked at submission time.
- A production `NEAR_AI_API_KEY` is required. Do not submit screenshots or copy implying live AI if the production endpoint is not verified.

## Likely judge questions

**Why is this better than letting an agent call a multisig or wallet directly?**
The payment request hits a purpose-built rules engine first. Recipient approval, status, time window, amount limits, daily usage, schedule, route, pause state, and caller identity are checked in a stable order before approval is logged.

**Can the AI override a rule?**
No. AI produces drafts, explanations, route advice, reports, and scenario descriptions. Only owner-signed transactions change policy, and Rust code determines payment outcomes.

**Does the security audit really test the contract?**
Yes. The owner-only method executes five scenarios through the same pure evaluator used by real requests. It moves no funds, returns structured results, and records five public-safe decisions. The UI refuses to show 5/5 unless it verifies those results.

**What is private today?**
The agent’s scheduled amount, raw worker address, and delivery destination are kept in its private store; the audit contains a decision ID, timestamp, outcome, and block height. Standard NEAR call arguments remain public, which is explicitly disclosed.

**How does a browser update a private server safely?**
The owner signs a scoped message containing the action, origin, nonce, expiry, and payload hash. The agent verifies the signature against NEAR, checks current contract ownership, rate-limits the request, prevents replay, validates the schema, and writes the plan atomically with restricted filesystem permissions.

**What stops an arbitrary user from editing another business plan?**
The private API calls `get_owner` on the target payroll contract and requires the signed account to match before any plan mutation.

**What happens if the agent is compromised?**
The contract still rejects requests that violate its configured identity, recipient, status, time, cap, daily, schedule, or route rules. The treasury can be paused immediately. Key scope for the exact deployed operator must be shown honestly in the demo.

**How are workers notified?**
Workers link email or Telegram to their wallet. After a finalized, verified `add_recipient` transaction, the private service resolves the saved worker account and notifies linked channels. Payment decisions and settlement state use the same wallet-linked preference store.

**Why use a factory?**
Each business receives an isolated account and state boundary instead of sharing one global payroll contract. The factory records owner-to-contract discovery for the browser and scheduler.

**Is the cross-chain payment live?**
Not in the current hackathon deployment. The approved payment creates a validated intent envelope and route, but the relay is deliberately in dry-run mode until production settlement credentials and liquidity are configured.

**What would you build next?**
Confidential submission of payment arguments, production Intents settlement, per-contract managed restricted agent keys, policy versioning, and multi-approver governance for high-risk changes.

## Credits and attribution

- Builder: Arinze — [@useClavis_](https://x.com/useClavis_)
- NEAR SDK and NEAR Wallet Selector
- NEAR AI Cloud
- NEAR Intents / solver relay interface
- NearBlocks explorer and API
- React, TypeScript, Vite, Tailwind CSS, Lucide, Playwright, Vitest, and Remotion
- Vercel, Oracle Cloud, PM2, Resend, and Telegram Bot API
- License: MIT

## Final submission checklist

### Product

- [ ] Production `/api/ai` succeeds for policy, anomaly, report, route, and security-scenario tasks.
- [ ] Add/edit/remove recipient updates both contract state and the private scheduler plan.
- [ ] Limits, agent update, pause/unpause, and emergency withdrawal each show pending/success/failure transaction toasts.
- [ ] Security audit returns verified `5/5` and the public audit receives five entries.
- [ ] Audit polling, anomaly bell, mark-all-read, empty states, skeletons, Escape-to-close, and Enter-to-submit are verified.
- [ ] Home, dashboard, audit, worker, setup, guides, legal pages, and 404 pass desktop and 375px smoke with zero console errors.

### Deployment

- [ ] `NEAR_AI_API_KEY` is configured as a Vercel server-side secret.
- [ ] Vercel production deployment is the final commit and `clavisapp.vercel.app` is healthy.
- [ ] VPS agent is the final commit, PM2 reports `clavis-agent online`, and the private API health check passes.
- [ ] Root and factory code hashes match the final release WASM.
- [ ] The deployed agent key mode shown in the pitch matches the real access-key permission.

### Repository and verification

- [ ] `bash scripts/verify.sh` passes on the final commit.
- [ ] `git diff --check` passes.
- [ ] Production dependency audit is reviewed and any accepted upstream advisories are documented.
- [ ] `feat/clavis-mvp` is pushed, reviewed, and merged to `main`.
- [ ] Repository visibility or explicit judge access is confirmed.
- [ ] README, HACKATHON.md, DEMO.md, SUBMISSION.md, SECURITY.md, LICENSE, and `.env.example` are current.

### Submission assets

- [ ] Four-minute walkthrough rehearsed twice.
- [ ] Final video uses the verified production build and includes no secrets, wallet recovery phrases, private keys, raw salary amounts, or personal contact details.
- [ ] Demo URL, repository URL, video URL, contract URLs, and security-audit transaction URL are added to the submission.
- [ ] Team profile, track selections, credits, and disclosures are complete.
- [ ] Final submission is previewed once in the hackathon form before publishing.
