# Clavis submission package

## Release status

Do not submit until every item in the final checklist is checked. In particular, the production NEAR AI key and live `/api/ai` verification are external release gates, not optional polish.

## Submission fields

**Project name**
Clavis

**Tagline**
Privacy-minimized, rule-bound payroll automation for autonomous agents on NEAR testnet.

**One sentence**
Clavis lets an AI payroll agent schedule work while an isolated Rust contract enforces recipients, caps, schedules, routes, emergency controls, and a privacy-minimized public audit.

**Short pitch**
Payroll automation creates a dangerous tradeoff: the more useful an agent becomes, the more treasury authority it usually receives. Clavis breaks that link. Owners configure payroll in the browser, use NEAR AI to draft and understand policy, and deploy an isolated NEAR contract that independently approves or rejects every request. The public audit omits recipient identities and amounts from its own entries while the product explicitly discloses normal NEAR transaction visibility and public recipient policy configuration.

**Full description**
Clavis is a NEAR testnet payroll control plane for remote teams. A business owner deploys an isolated contract, defines global and per-recipient limits, approves destination routes, configures a private scheduled amount, and appoints an agent account. The TypeScript scheduler checks due work every 60 seconds, but the Rust contract remains the authority for pause state, caller identity, recipient approval, active status, off-hours policy, per-payment limits, personal caps, daily limits, schedules, and routes.

NEAR AI is used where language adds value: it converts plain-English policy into an editable draft, explains anomalies, recommends a testnet route from live RPC observations, and produces a CFO-style report from privacy-minimized audit data. Security probes are fixed and versioned rather than model-generated; after the contract returns five structured results, NEAR AI may summarize those verified facts as an advisory explanation.

Sensitive delivery configuration is signed by the owner in the browser and stored in the access-controlled agent service rather than in the public audit log. Approved work is prepared for a NEAR Intents settlement adapter. The current hackathon deployment is testnet-only; routes are preflighted and completed cross-chain settlement is not claimed without a filled solver reference.

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
- **Account model and access keys:** one restricted Function Call key per payroll contract, each verified on-chain as `request_payment`-only; Full Access payroll-agent keys are rejected. NEP-413 settlement signing uses a separate, minimally funded account that is rejected if it overlaps any payroll agent account.
- **Factory architecture:** one isolated `*.clavis.testnet` contract per business.
- **Fast testnet UX:** wallet-signed setup and policy updates from the browser.
- **NEAR Intents:** a settlement abstraction for worker-selected routes after contract approval.
- **Public verification:** NearBlocks links connect UI decisions to testnet transactions.

## NEAR AI usage

Server-side endpoint: `https://cloud-api.near.ai/v1/chat/completions`

Preferred model: `meta-llama/Llama-3.3-70B-Instruct`

Live fallback: `deepseek-ai/DeepSeek-V4.1-Flash-1017`. NEAR AI retired the preferred Llama entry
from its live catalog before release, so the proxy checks model availability and selects the first
supported NEAR-hosted instruction model. Successful responses expose the active choice through the
`x-clavis-ai-model` header.

Implemented tasks:

1. Plain-English policy extraction into limits, schedule, recipient caps, summary, and warnings.
2. Cautious anomaly explanation with a recommended owner action.
3. CFO-style report from the latest thirty privacy-minimized audit entries.
4. Testnet route recommendation enriched with point-in-time NEAR, Sepolia, and BNB RPC observations.
5. Human-readable descriptions of five canonical security scenarios before the contract evaluates them.

The API key stays in the Vercel serverless environment. Browser code calls same-origin `/api/ai` and never imports the secret.

## Strongest differentiators

- **AI is not the authority.** It assists with language; deterministic contract code controls funds.
- **Security evidence is reproducible.** A versioned threat model maps claims to repeatable contract and agent tests; five on-chain probes provide an additional browser demonstration without moving funds.
- **Audit data is deliberately minimized.** Scheduled amounts and destination addresses live in an owner-authorized off-chain plan; audit entries contain decision evidence rather than payroll identities or amounts. Standard chain arguments remain public.
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
| Security | Fail-closed policy engine, owner-only controls, restricted keys, mapped CI tests, and observable five-scenario probes |
| Privacy | Access-controlled delivery plan plus privacy-minimized audit entries, with standard-NEAR visibility disclosed |
| Real-world | Payroll operations, worker portal, notifications, reports, and recovery controls |
| Business | Isolated contracts per business, CFO summary, roster management, and clear operating documentation |

## Verified evidence

Run this exact gate after the final integration commit:

```bash
bash scripts/verify.sh
git diff --check
```

Most recent component evidence before final release:

- Agent tests: `50/50` passing.
- Contract tests: `21/21` passing.
- Factory tests: `3/3` passing.
- Frontend, agent, and API TypeScript checks pass.
- Production frontend build and both release WASM builds pass.
- Playwright public-proof suite: `5/5` passing across landing, dashboard, audit, security, and 390px mobile navigation; no horizontal overflow or console errors.
- Root and factory testnet code matched the locally built release WASM when checked.
- Live security audit transaction `Ng3cFYga534jZJJoFeAuzDgH5xLrMXP9Yrg52gkT4rc` returned five blocked results and wrote payment IDs 5–9.
- Production dependency audit has no moderate, high, or critical findings. It reports 17 low-severity transitive `elliptic` advisories in the NEAR wallet stack; the available forced remediation is a breaking dependency upgrade and is documented rather than applied blindly.

Replace this section with the final command timestamp and commit SHA before submission.

## Honest disclosures

- Clavis is **NEAR testnet only**.
- Completed cross-chain settlement is not claimed without a `FILLED` solver intent and verifiable relay reference. Unsupported cross-chain preferences fail visibly instead of being replaced with direct NEAR.
- The public audit omits recipient identities and amounts. Standard NEAR function-call arguments and current recipient policy configuration are still public; complete confidentiality requires the documented confidential-executor boundary.
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
Yes, as a demonstration layer. The owner-only method executes five fixed scenarios through the same pure evaluator used by real requests. It moves no funds, returns structured results, and records five minimized decisions. The stronger evidence is the reproducible threat-model suite mapped to versioned contract and agent tests.

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
