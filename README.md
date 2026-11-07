# Clavis — Privacy-Minimized Payroll Controls on NEAR

> Give an AI agent enough authority to run payroll—and no authority to break the rules.

[![CI](https://github.com/arinze116/Clavis/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/arinze116/Clavis/actions/workflows/ci.yml)
[![Security evidence](https://github.com/arinze116/Clavis/actions/workflows/security-evidence.yml/badge.svg?branch=main)](https://github.com/arinze116/Clavis/actions/workflows/security-evidence.yml)

**[Live app](https://clavisapp.vercel.app)** · **[Dashboard](https://clavisapp.vercel.app/dashboard)** · **[Public audit](https://clavisapp.vercel.app/audit)** · **[Security evidence](https://clavisapp.vercel.app/security)** · **[Guides](https://clavisapp.vercel.app/guide)**

Clavis is a deployed NEAR testnet payroll control plane for remote teams. A business gives an autonomous agent permission to request scheduled payroll, but never gives that agent permission to change recipients, limits, schedules, routes, pause state, or treasury rules. An isolated Rust contract evaluates every request and records the decision.

The central idea is simple:

> AI proposes and prioritizes. The owner signs. The contract decides. The chain provides the evidence.

## Contents

- [Problem and solution](#problem)
- [Five-minute judge quickstart](#judge-quickstart--five-minutes-no-wallet-required)
- [Why Clavis is different](#why-clavis-is-different)
- [Live status and verified evidence](#what-is-live-now)
- [System architecture](#how-the-system-works-together)
- [AI truth boundary](#ai-truth-boundary)
- [Reviewer code map](#reviewer-code-map)
- [Local verification and deployment](#verify-locally)
- [Honest limitations](#honest-limitations)
- [Detailed judge demo](#detailed-demo-flow-for-judges)

## At a glance

| Question | Answer |
| --- | --- |
| What problem does Clavis solve? | Payroll agents are useful only if they can act, but giving an agent direct treasury authority creates unacceptable recipient, amount, timing, and key-compromise risk. |
| What did we build? | A browser product, contract factory, isolated payroll contracts, autonomous scheduler, private-plan service, notification system, NEAR AI proxy, public audit, security evidence page, and NEAR Intents delivery adapter. |
| What is the security model? | The agent receives a per-contract Function Call key restricted to `request_payment`; the Rust contract independently enforces the policy in a stable order. |
| What is private? | Before execution, scheduled amounts, raw worker addresses, delivery destinations, notification contacts, and private plans stay in the access-controlled VPS store and outside the Clavis audit shape. |
| What is public? | Standard NEAR function-call arguments and the configured recipient policy remain public; submitted payment values may therefore be visible on-chain. Clavis does not claim full payroll confidentiality. |
| How is AI used? | NEAR AI extracts source-grounded policy candidates and chooses only bounded recommendation, hypothesis, route, or next-step codes. It cannot create factual evidence or override a contract rule. |
| Is it live? | Yes: frontend/API on Vercel, root and factory contracts on NEAR testnet, scheduler and notification API on Oracle Cloud, and model-backed NEAR AI requests in production. |
| What is deliberately limited? | The release is testnet-only. Cross-chain delivery is not called complete without a `FILLED` solver reference, and the current public demo does not claim one. |

## Problem

Conventional payroll automation usually gives a bot or backend wallet enough authority to move treasury funds directly. If its key, scheduler, or model is compromised, it may pay an unapproved account, exceed a cap, run at the wrong time, repeat a payment, or hide the decision behind opaque application logs.

Remote teams also face a transparency tradeoff: putting every payroll detail on-chain exposes sensitive data, while keeping every decision off-chain makes the automation difficult to audit.

## Solution

Clavis separates execution from authority:

1. The owner deploys an isolated payroll contract and signs its public policy.
2. A private, owner-authorized plan stores the scheduled amount and delivery destination off-chain.
3. A restricted agent checks due work and may call only `request_payment`.
4. The Rust contract independently approves or rejects the request using owner-defined rules.
5. The minimized decision is auditable on NEAR, while private delivery data remains in the protected agent service.
6. NEAR AI helps draft and interpret policy, but all operational facts and outcomes come from source text, contract state, or transaction evidence.

## Judge quickstart — five minutes, no wallet required

1. Open the [landing page](https://clavisapp.vercel.app) for the product thesis and privacy boundary.
2. Open the [dashboard](https://clavisapp.vercel.app/dashboard) to inspect live `clavis.testnet` treasury, policy, recipients, authorization history, and anomaly evidence directly from final-state RPC.
3. Open the [public audit](https://clavisapp.vercel.app/audit) and follow its NearBlocks links. Audit entries omit salary amounts and recipient identities, while the UI discloses normal chain visibility.
4. Open [security evidence](https://clavisapp.vercel.app/security) for the threat model, source-linked test evidence, known limitations, and five fixed on-chain probe results.
5. Open [setup](https://clavisapp.vercel.app/setup) to inspect the seven-step isolated-contract deployment flow and grounded AI policy drafting.
6. Open the [business, worker, and developer guides](https://clavisapp.vercel.app/guide) for the complete product workflow.

Wallet-signed owner actions are intentionally gated. The public evidence paths above remain useful without a wallet.

## Why Clavis is different

### 1. Autonomous execution without autonomous policy

The scheduler can call only `request_payment` on the assigned payroll contract. It cannot add a recipient, raise a cap, change the agent, pause or resume the treasury, or withdraw funds. Those actions require the owner wallet.

### 2. Contract-enforced policy, not prompt-enforced policy

Recipient approval, recipient status, caller identity, pause state, operating hours, per-payment limits, personal caps, daily limits, schedules, and routes are enforced in Rust. A prompt injection, model outage, or compromised scheduler cannot rewrite those rules.

### 3. AI output cannot become fake operational evidence

Contract-backed AI tasks reload NEAR final state on the server and pin related reads to one exact final block. Clavis renders factual sentences deterministically. The model can select only a bounded code or hypothesis that the server validates.

### 4. One isolated contract per business

The factory creates `*.clavis.testnet` accounts with separate state and treasury boundaries. A business does not share one mutable payroll ledger with every other Clavis customer.

### 5. Privacy claims match the implementation

Clavis minimizes its own audit data and keeps delivery plans private, but it does not pretend standard blockchain calls are confidential. The exact boundary is documented in [docs/PRIVACY.md](docs/PRIVACY.md).

### 6. Unsupported settlement fails visibly

An unavailable cross-chain preference is never silently replaced with a direct NEAR payment and then reported as cross-chain delivery. A completed cross-chain claim requires a persisted `FILLED` intent and verifiable relay reference.

## Why NEAR

- **Function Call keys** restrict each agent key to `request_payment` on one payroll contract at the protocol layer.
- **Subaccounts** let the factory create an isolated `*.clavis.testnet` account and state boundary for each business.
- **Rust and NEAR SDK** provide deterministic treasury rules, owner-only recovery controls, and promise-based provisioning.
- **NEP-413 signatures** authorize private-plan and notification changes without giving the browser or Vercel the owner key.
- **Final-state RPC** provides coherent evidence snapshots that the UI and AI proxy can pin to an exact block.
- **NEAR Intents** supplies the delivery abstraction for worker-selected routes while allowing Clavis to require verifiable settlement references.
- **NEAR AI Cloud** keeps the language-assistance layer inside the NEAR ecosystem while the application still validates every model output.

## What is live now

| Component | Release status | Evidence |
| --- | --- | --- |
| Frontend and serverless APIs | Live on Vercel | [clavisapp.vercel.app](https://clavisapp.vercel.app) and passing Vercel checks on `main` |
| Root payroll contract and provisioner | Live on NEAR testnet | [`clavis.testnet`](https://testnet.nearblocks.io/address/clavis.testnet) |
| Factory | Live on NEAR testnet | [`factory.clavis.testnet`](https://testnet.nearblocks.io/address/factory.clavis.testnet) |
| Autonomous scheduler | Live under PM2 on Oracle Cloud | 60-second discovery and payroll cycle; release health check passed |
| Contract event watcher | Live under PM2 | 10-second decision/anomaly polling with notification fan-out |
| Notification bridge | Live | Same-origin Vercel proxy reaches the private VPS API; unsupported no-op smoke returned the expected agent-side `400` |
| NEAR AI | Live | Production policy, report, anomaly, route, and security tasks returned HTTP `200` during release verification |
| Native NEAR delivery path | Implemented | Direct NEAR route is supported after contract authorization |
| Cross-chain delivery | Adapter and evidence state implemented | No completed public demo settlement is claimed without a `FILLED` solver reference |

Clavis is intentionally testnet-only. Testnet assets have no monetary value.

## Verified release evidence

| Evidence | Verified result |
| --- | --- |
| Application and contract source release | [PR #9](https://github.com/arinze116/Clavis/pull/9), merge `a7acd65` |
| API evidence tests | `23/23` passed |
| Agent tests | `54/54` passed |
| Payroll contract tests | `22/22` passed |
| Factory tests | `3/3` passed |
| Browser proof paths | `5/5` passed across desktop and mobile coverage |
| Root upgrade | [Transaction `6wQpeS…PXpj`](https://testnet.nearblocks.io/txns/6wQpeSvVKPG29Tc66H8J2ak6N4ESCyY9AWL8WvGsPXpj) |
| Root deployed code | Hash `6KVr9Wh2JPibe796e7xEMCRQCqKzRAY5N6JPyPg5S3NV`; byte-for-byte match with release WASM |
| Factory upgrade | [Transaction `7iPSiT…q3Mn`](https://testnet.nearblocks.io/txns/7iPSiTGWogj4ovkcjh63gtbMUyY2HKUJMscMPVcwq3Mn) |
| Factory deployed code | Hash `DgajXyTxZbvwDznWM8udMDU5L3kDoAgqUHFDSzWKodsW`; byte-for-byte match with release WASM |
| Five-scenario security audit | [Transaction `Ng3cFY…T4rc`](https://testnet.nearblocks.io/txns/Ng3cFYga534jZJJoFeAuzDgH5xLrMXP9Yrg52gkT4rc), payment IDs `5–9`, all five blocked |
| Production AI verification | Policy plus all four bounded-choice tasks returned HTTP `200` through `deepseek-ai/DeepSeek-V4.1-Flash-1017`; contract-backed tasks exposed exact final-block provenance |
| Dependency audit | No moderate, high, or critical production findings; 17 accepted low-severity transitive `elliptic` advisories in the NEAR wallet stack |

Reproduce the repository gate with `bash scripts/verify.sh`. Detailed release evidence is recorded in [SUBMISSION.md](SUBMISSION.md) and [TASKS.md](TASKS.md).

## How the system works together

```mermaid
flowchart LR
    Owner["Business owner"] --> Browser["React web app"]
    Worker["Worker"] --> Browser

    Browser -->|"wallet-signed public policy"| Factory["factory.clavis.testnet"]
    Factory -->|"factory-only provision request"| Root["clavis.testnet provisioner"]
    Root -->|"create, fund, deploy, initialize"| Payroll["isolated *.clavis.testnet payroll contract"]

    Browser -->|"NEP-413 signed private plan"| PrivateProxy["Vercel notification/private-plan proxy"]
    PrivateProxy -->|"HTTPS or restricted SSH forward"| Agent["private TypeScript agent on Oracle Cloud"]
    Agent -->|"request_payment every due cycle"| Payroll
    Payroll -->|"approve or reject"| Audit["privacy-minimized public audit"]
    Agent -->|"preflight and delivery state"| Intents["NEAR Intents adapter"]
    Agent --> Notifications["Resend and Telegram"]

    Browser -->|"final-state reads"| Rpc["NEAR testnet RPC"]
    AiProxy["Vercel NEAR AI proxy"] -->|"exact final-block evidence"| Rpc
    Browser --> AiProxy
    AiProxy -->|"bounded task prompt"| NearAi["NEAR AI Cloud"]
```

### Near-real-time behavior

Clavis does not simulate a stream or claim websocket finality:

- dashboard, audit, and anomaly state poll NEAR final state every 10 seconds;
- browser focus triggers an immediate refresh;
- the payroll scheduler discovers contracts and evaluates due work every 60 seconds;
- a separate contract-event watcher checks new decisions and anomalies every 10 seconds;
- AI report, anomaly, and security requests pin all related contract reads to one final block;
- stale and failed refreshes are shown as stale/error states instead of silently retaining fake freshness.

## AI truth boundary

| AI task | What the model may do | What Clavis verifies or renders deterministically |
| --- | --- | --- |
| Policy drafting | Extract candidate limits, one schedule, and named recipient caps | Every value must be explicitly associated with the correct role in the owner's source text; ambiguous, invented, swapped, or fiat-only values are rejected or require clarification |
| Payroll report | Select one recommendation code from server-provided options | Treasury, recipients, audit decisions, anomalies, authorization-window usage, and every factual sentence come from one NEAR final block |
| Anomaly analysis | Select one cautious cause hypothesis and two action codes | Anomaly ID, type, severity, timestamp, description, and recent decisions are reloaded from the contract |
| Route advice | Select one route marked code-supported | RPC status, observation time, latency, gas-unit values, support status, and all explanatory measurements are server-rendered |
| Security summary | Select one next-step code | Five canonical outcomes are matched by payment ID and rejection reason against the live audit ledger |

If NEAR AI is unavailable, report, anomaly, route, and security tasks fall back to the deterministic verified-evidence engine and identify that fallback honestly. Policy extraction fails visibly because inventing policy would be unsafe.

## Architecture and trust boundaries

The system has four separate authorities:

1. **Owner wallet:** authorizes public policy, private-plan changes, recovery controls, and deployments.
2. **Payroll contract:** makes the final authorization decision and records the minimized audit result.
3. **Agent service:** schedules due work, stores private delivery data, submits allowed requests, tracks delivery state, and sends notifications.
4. **AI service:** assists with language and prioritization but has no signing key, contract authority, or ability to change evidence.

The public audit contains payment ID, timestamp, block height, outcome, and rejection reason. It does not store salary amounts, recipient hashes, wallet addresses, or destination routes. Standard NEAR transaction arguments and chain metadata remain public.

The current contract also exposes recipient policy configuration, including display labels, caps, schedules, and preferred routes. Use pseudonymous labels on testnet. Clavis does not claim confidential payroll until policy state and payment authorization move behind the documented confidential-execution boundary.

Detailed design documents:

- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT-MODEL.md)
- [Privacy boundary](docs/PRIVACY.md)
- [Generated security evidence](docs/generated/security-report.md)
- [Demo script and fallback plan](DEMO.md)
- [Submission package](SUBMISSION.md)

## Technology stack

| Layer | Technology |
| --- | --- |
| Payroll and factory contracts | Rust, NEAR SDK `5.17.2`, Borsh |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Wallets | NEAR Wallet Selector, Meteor Wallet, MyNearWallet, Sender |
| Agent service | TypeScript, Node.js, PM2, Zod |
| AI | NEAR AI Cloud through origin-validated, rate-limited Vercel functions |
| Chain access | NEAR final-state JSON-RPC, `@near-js/providers`, NearBlocks API |
| Settlement | NEAR Intents relay adapter with persisted `PENDING`, `FILLED`, and `FAILED` state |
| Notifications | Resend, Telegram Bot API, private HTTP API, restricted SSH fallback |
| Infrastructure | Vercel, Oracle Cloud Ubuntu 22.04, Nginx/Certbot support |
| Verification | Rust tests, Node test runner, Vitest, Playwright, GitHub Actions |

## Implemented product capabilities

- Self-service business contract deployment under `*.clavis.testnet`
- Public read-only dashboard with owner-only mutation controls
- Worker registration checks, preferences, QR wallet sharing, and payment history
- NEAR Intents relay adapter with preflight, persisted status, and retries
- Direct NEAR settlement path for native NEAR routes
- Multi-contract payroll scheduling every 60 seconds
- Resend email and Telegram Bot API notifications
- Wallet-linked notification preferences authorized with NEP-413 signatures
- Per-contract anomaly, audit, intent, private-plan, and report state
- Grounded NEAR AI policy extraction, anomaly hypotheses, live-RPC route advice, and verified payroll reports
- CI-backed threat model plus five deterministic browser probes recorded in the public contract log
- Interactive business, worker, and developer guides at `/guide`
- Responsive React interface, loading skeletons, error boundaries, transaction toasts, legal pages, and branded 404
- PM2 deployment and health scripts for Ubuntu 22.04 on Oracle Cloud

## Repository

```text
contract/   Payroll contract, factory contract, rules, audit, and Rust tests
agent/      Multi-contract scheduler, intents, notifications, reports, and tests
frontend/   React, TypeScript, Tailwind, wallet connection, dashboards, and setup
scripts/    Contract deployment, verification, VPS setup, deployment, and health checks
docs/       Privacy and security notes
```

### Reviewer code map

| Question | Primary implementation | Evidence/tests |
| --- | --- | --- |
| Where are payroll rules enforced? | [`contract/src/rules.rs`](contract/src/rules.rs), [`contract/src/payments.rs`](contract/src/payments.rs), [`contract/src/treasury.rs`](contract/src/treasury.rs) | [`contract/src/tests.rs`](contract/src/tests.rs) |
| How are isolated business contracts created? | [`contract/src/factory.rs`](contract/src/factory.rs), [`contract/src/lib.rs`](contract/src/lib.rs) | Factory tests in [`contract/src/factory.rs`](contract/src/factory.rs) |
| How are the five security probes implemented? | [`contract/src/security.rs`](contract/src/security.rs) | Contract tests plus [threat model](docs/THREAT-MODEL.md) |
| Where is autonomous scheduling implemented? | [`agent/src/scheduler.ts`](agent/src/scheduler.ts), [`agent/src/trigger.ts`](agent/src/trigger.ts), [`agent/src/near.ts`](agent/src/near.ts) | Agent Vitest suites beside each module |
| How are newest anomalies monitored? | [`agent/src/contract-event-monitor.ts`](agent/src/contract-event-monitor.ts) | [`agent/src/contract-event-monitor.test.ts`](agent/src/contract-event-monitor.test.ts) |
| How are private plans and notifications authorized? | [`agent/src/notification-auth.ts`](agent/src/notification-auth.ts), [`agent/src/notification-api.ts`](agent/src/notification-api.ts), [`agent/src/payroll-plan-store.ts`](agent/src/payroll-plan-store.ts) | Notification/auth/store tests in `agent/src/*.test.ts` |
| How is settlement state handled? | [`agent/src/intents.ts`](agent/src/intents.ts), [`agent/src/intent-store.ts`](agent/src/intent-store.ts) | [`agent/src/intents.test.ts`](agent/src/intents.test.ts) |
| Where is the AI trust boundary enforced? | [`frontend/api/ai.ts`](frontend/api/ai.ts), [`frontend/src/utils/nearAi.ts`](frontend/src/utils/nearAi.ts) | [`tests/api/ai.test.ts`](tests/api/ai.test.ts) |
| How does the UI read coherent chain state? | [`frontend/src/utils/contract.ts`](frontend/src/utils/contract.ts), [`frontend/src/hooks/useContractState.ts`](frontend/src/hooks/useContractState.ts) | [`tests/e2e/public-proof.spec.ts`](tests/e2e/public-proof.spec.ts) |

## Requirements

- Node.js 20.19 or newer
- Rust stable and `wasm32-unknown-unknown`
- NEAR CLI RS
- NEAR testnet accounts for the root owner and restricted payroll agent

```bash
rustup target add wasm32-unknown-unknown
npm ci
npx playwright install chromium
cp .env.example agent/.env
cp .env.example frontend/.env
```

Never commit `.env`, payroll plans, agent state, reports, or private keys.

## Verify locally

Run the complete gate:

```bash
bash scripts/verify.sh
```

The gate builds both WASM contracts and runs:

```bash
cargo test --manifest-path contract/Cargo.toml
cargo test --manifest-path contract/Cargo.toml --package clavis-factory
npm run test:api
npm run test:agent
npm run typecheck
npm run build
npm run test:e2e:built
```

## Factory deployment

The factory embeds the audited payroll WASM. `factory.clavis.testnet` cannot create a sibling account directly, so the root `clavis.testnet` contract exposes a factory-only provisioner that creates, funds, deploys, and initializes each `*.clavis.testnet` account.

With both NEAR accounts available in the legacy NEAR CLI keychain:

```bash
bash scripts/deploy-factory.sh
```

The deployment script builds both WASM files, upgrades the root provisioner without replacing state, creates `factory.clavis.testnet` when needed, and initializes it with `clavis.testnet` as its root.

Each owner calls:

```text
create_payroll(name, owner, agent, daily_limit, per_payment_limit)
```

The call requires a 6 NEAR testnet deployment deposit. One owner can have one deployed or pending business contract.

## Frontend

```bash
npm run dev:frontend
```

Wallet connection supports Meteor Wallet, MyNearWallet, and Sender through NEAR Wallet Selector.

Routes:

- `/` — product landing page
- `/dashboard` — owner console discovered from `get_contract_by_owner`
- `/worker` — worker registration and payroll portal
- `/audit` — public decisions with NearBlocks transaction links
- `/setup` — seven-step factory deployment flow
- `/guide` — role-based business, worker, and developer documentation
- `/privacy` — privacy policy
- `/terms` — testnet terms

Production variables:

```dotenv
VITE_NEAR_NETWORK=testnet
VITE_NEAR_RPC_URL=https://rpc.testnet.fastnear.com
VITE_FACTORY_CONTRACT_ID=factory.clavis.testnet
VITE_ROOT_CONTRACT_ID=clavis.testnet
VITE_EXPLORER_URL=https://testnet.nearblocks.io
VITE_NEARBLOCKS_API_URL=https://api-testnet.nearblocks.io
```

NEAR AI requests are sent through the Vercel serverless proxy at `/api/ai`; the API key is
never imported into browser code. Configure these as server-side Vercel variables:

```dotenv
NEAR_AI_API_KEY=replace-with-near-ai-cloud-key
NEAR_AI_MODELS=meta-llama/Llama-3.3-70B-Instruct,deepseek-ai/DeepSeek-V4.1-Flash-1017
NEAR_AI_MODEL_TIMEOUT_MS=25000
```

The proxy checks NEAR AI's `/v1/models` catalog, caches it briefly, and uses the first available
configured model. If NEAR changes the catalog, the proxy can select another instruction/chat model
automatically; if catalog discovery is unavailable, it falls back to the configured priority list.
Each model receives a bounded attempt within a 52-second total request budget. The browser and
server allow enough time for longer payroll reports while still terminating stalled requests. Update
`NEAR_AI_MODELS` in Vercel to change model priority without deploying code. The browser never
receives the API key. Models that fail are temporarily deprioritized, so the same server instance
reuses the most recently successful fallback instead of repeating a slow failure on every request.

Payroll reports do not trust metrics supplied by the browser. The server reloads the audit ledger,
anomalies, recipients, contract balance, and authorization-window counter directly from NEAR final-state RPC,
pins every read to one exact final block, builds every factual sentence deterministically, and lets
the model choose only from evidence-backed recommendation codes. Security summaries independently
match all five returned probe payment IDs and rejection reasons against the live contract audit
ledger. If NEAR AI is temporarily unavailable, report, security, anomaly, and route views still
return verified deterministic output; policy extraction fails visibly until a valid key is present.
Anomaly analysis reloads the selected anomaly and recent decisions from the contract by ID,
policy values are discarded unless they appear in the owner's source text, and route measurements
are rendered from the RPC snapshot rather than model-written numbers. Reports call an approved
contract decision an authorization, never proof of off-chain delivery. The dashboard, audit ledger,
and anomaly bell poll final-state evidence every ten seconds and refresh immediately on focus; this
is honest near-real-time polling, not a simulated stream. Anomaly readers page from the newest
records so later entries cannot disappear behind the first 100.

The owner-only `run_security_audit()` contract method records five privacy-minimized rejected audit
entries without moving funds or changing treasury policy. These browser probes are demonstration
evidence; the versioned threat model and CI-mapped tests at `/security` are the primary security
evidence. On 2026-11-07, the root and factory were upgraded from merged release commit `a7acd65`;
their deployed code hashes were verified byte-for-byte against the release WASM. Existing child
accounts retain the bytecode they were originally created with, while new factory deployments use
the upgraded embedded payroll WASM.

## Multi-business payroll configuration

The scheduler discovers contracts through `factory.clavis.testnet -> get_all_contracts()`.
During browser setup, the owner signs the private payroll payload with their wallet; the agent
verifies that signer against the contract's `get_owner`, then stores amounts and destination
addresses in mode-`0600` files on the VPS. These values never enter the public contract or audit
log. The manual aggregate file remains available for local development and legacy deployments.

`agent/config/payroll.local.json`:

```json
{
  "businesses": [
    {
      "contract_id": "acmecorp.clavis.testnet",
      "owner_email": "owner@acmecorp.com",
      "telegram_chat_id": "123456789",
      "recipients": []
    }
  ]
}
```

A business can override its aggregate entry with `agent/config/payrolls/{contract_id}.json`. Every business-cycle log includes `contractId`.

## Testnet settlement and evidence boundary

The agent calls the live relay at `https://solver-relay-v2.chaindefuser.com/rpc`.

Testnet asset identifiers:

- NEAR: `nep141:wrap.testnet`
- Ethereum USDC test route: `nep141:usdc.fakes.testnet`
- BNB test route: wrapped NEAR equivalent

Intent state is written atomically to `agent/data/intents.json` with `PENDING`, `FILLED`, and `FAILED` states. Failed submissions receive three retries after the initial attempt with a 30-second minimum backoff.

The public relay may return no quote for fake testnet assets. Native NEAR routes settle directly to
the recipient's NEAR testnet account. Ethereum and BNB preferences fail visibly when no supported
solver route exists. Route availability is preflighted before `request_payment`, so a known-unavailable
delivery does not consume daily policy capacity or advance the recipient schedule. Clavis never substitutes direct NEAR and calls it cross-chain settlement.
Completed cross-chain delivery is not claimed unless a solver intent reaches `FILLED` with a
verifiable relay reference.

```dotenv
INTENTS_CONTRACT_ID=intents.near
SOLVER_RELAY_URL=https://solver-relay-v2.chaindefuser.com/rpc
INTENTS_API_KEY=
SETTLEMENT_ACCOUNT_ID=clavis-settlement.testnet
SETTLEMENT_PRIVATE_KEY=ed25519:...
```

The settlement signer is a separate, minimally funded account used only for delivery submission. It
must not be any payroll agent account. The runtime rejects that overlap so a settlement signing key
cannot weaken the `request_payment`-only authorization boundary. The settlement key must never be
exposed to the browser. NEP-413 intent signing requires a Full Access key on this separate settlement
account; that key has no authority over payroll contracts and should hold only the funds required for
the current delivery operation.

## Notifications

Notification failures are isolated with `Promise.allSettled`; email or Telegram downtime never stops payroll.
The payroll scheduler keeps its 60-second cycle, while a separate contract-event watcher checks
new payment decisions and anomalies every 10 seconds and dispatches Telegram alerts immediately.

The Resend, Telegram, VPS, and Vercel values below are configured once by the Clavis
operator. End users never receive or edit those credentials.

Connected users can click their wallet pill in the app header to link an email address,
Telegram, or both without touching VPS or Vercel settings. Email is confirmed with a
six-digit code. Telegram opens the Clavis bot with a short-lived pairing token and the web
popup confirms automatically after the user presses Start. Contact details stay in the
private VPS data store and are never written on-chain. NEP-413 wallet signatures bind each
setup change to the connected account and issue a revocable notification session.

The following events are covered:

- payroll deployment and every owner-submitted contract transaction;
- worker creation, removal, suspension, and reinstatement;
- limit, agent, pause, resume, anomaly-review, and emergency-withdrawal changes;
- payment approvals and rejections;
- intent submission, delivery completion, and terminal delivery failure;
- anomaly detection and daily reports.

Transaction alerts are derived from the finalized NEAR transaction rather than trusting
labels supplied by the browser. Duplicate transaction hashes are suppressed.

### Resend

1. Create a Resend API key.
2. Use Resend's onboarding sender on testnet. After domain verification, use `payroll@clavisapp.vercel.app`.
3. Configure:

```dotenv
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Clavis Testnet <onboarding@resend.dev>
```

### Telegram

1. Create a bot with `@BotFather` and copy its token.
2. Copy the bot username shown by BotFather.
3. Configure the dedicated bot on the agent. The agent polls `/start` pairing messages and
   securely resolves each user's chat ID; users never copy or paste IDs.

`TELEGRAM_CHAT_ID` is an optional fallback destination for legacy per-business notifications.

```dotenv
TELEGRAM_BOT_TOKEN=123456:...
TELEGRAM_BOT_USERNAME=ClavisNotificationsBot
TELEGRAM_CHAT_ID=123456789
```

Wallet-linked preferences take precedence over per-business values; per-business
`telegram_chat_id` values otherwise override the global default.

### Wallet-linked notification API

Generate a strong shared key (`openssl rand -base64 48`) and configure the VPS agent:

```dotenv
NOTIFICATION_API_ENABLED=true
NOTIFICATION_API_KEY=replace-with-at-least-32-random-bytes
NOTIFICATION_API_HOST=127.0.0.1
NOTIFICATION_API_PORT=8787
NOTIFICATION_PREFERENCES_PATH=./data/notification-preferences.json
NOTIFICATION_ALLOWED_ORIGINS=https://clavisapp.vercel.app
```

Expose the loopback API through HTTPS after pointing a domain at the VPS. In the
Oracle Cloud subnet security list (or attached NSG), first allow inbound TCP 80
and 443 from `0.0.0.0/0`; the script also adds the matching host firewall rule.

```bash
CLAVIS_NOTIFICATION_DOMAIN=notifications.example.com \
CLAVIS_LETSENCRYPT_EMAIL=ops@example.com \
bash scripts/vps-notifications.sh
```

Add these server-side variables to the Vercel project that owns `clavisapp.vercel.app`
and to any separate preview project. They must not use the `VITE_` prefix:

```dotenv
CLAVIS_AGENT_API_URL=https://notifications.example.com/v1/notifications
CLAVIS_AGENT_API_KEY=the-same-private-shared-key
```

If Oracle ingress cannot be changed, omit `CLAVIS_AGENT_API_URL` and configure
the Vercel proxy with a dedicated SSH key instead:

```dotenv
CLAVIS_AGENT_API_KEY=the-same-private-shared-key
CLAVIS_AGENT_SSH_HOST=203.0.113.10
CLAVIS_AGENT_SSH_PORT=22
CLAVIS_AGENT_SSH_USER=ubuntu
CLAVIS_AGENT_SSH_PRIVATE_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...
CLAVIS_AGENT_SSH_HOST_KEY_SHA256=64-character-sha256-hex-digest
```

The corresponding `authorized_keys` entry must use a forced command and only
allow forwarding to the loopback notification port:

```text
command="/bin/false",no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc,permitopen="127.0.0.1:8787" ssh-ed25519 ... vercel-clavis-notifications
```

Local frontend development can override `VITE_NOTIFICATION_API_URL`; production uses the
same-origin `/api/notifications` Vercel proxy. Add an active preview URL to
`NOTIFICATION_ALLOWED_ORIGINS` before testing signed linking on that preview.

## Oracle Cloud VPS deployment

The scripts target Ubuntu 22.04 and install Node.js 20, Git, and PM2.

```bash
bash scripts/vps-setup.sh
sudo nano /opt/clavis/agent/.env
cd /opt/clavis
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Production setup and deployment default to `main`. Override `CLAVIS_BRANCH` only for an intentional
non-production environment:

```bash
CLAVIS_BRANCH=your-branch bash scripts/vps-setup.sh
```

Update and verify:

```bash
bash scripts/vps-deploy.sh
bash scripts/vps-status.sh
```

Expected PM2 status: `clavis-agent online`.

## Agent key model

Every payroll contract uses its own Function Call access key restricted to `request_payment` on that
contract. A single agent account may hold several restricted keys, but the runtime selects the key by
contract and verifies its on-chain permission before starting.

```dotenv
AGENT_CREDENTIALS_PATH=./config/agent-credentials.local.json
```

Copy `agent/config/agent-credentials.example.json`, add one distinct restricted private key per
contract, set file mode `0600`, and keep the local file out of Git. Full Access agent keys are always
rejected. Legacy `NEAR_ACCOUNT_ID`, `NEAR_PRIVATE_KEY`, and `LEGACY_AGENT_CONTRACT_ID` variables are
supported only for that explicitly named single contract and are still verified as an exact
`request_payment` Function Call permission.

Provision each restricted key with `scripts/create-function-key.sh`, setting `CONTRACT_ID` to the
target payroll contract for each run. This signs an on-chain access-key transaction and therefore
must be performed deliberately by the operator; the repository does not auto-sign or expose keys.

## Contract policy

`request_payment` enforces:

1. contract is not paused;
2. caller is the configured agent;
3. recipient commitment exists and is active;
4. amount is positive and inside global and personal caps;
5. the daily counter is current and projected spend is inside the daily limit;
6. the payment schedule is due;
7. the chain/token route was approved by the owner.

Unauthorized public calls do not append audit state, preventing storage-exhaustion attacks. Recipient hashes are validated as lowercase SHA-256 digests and recipient count is capped.

## Hackathon track and judging fit

| Track / criterion | Concrete evidence in Clavis |
| --- | --- |
| Agents | A live TypeScript scheduler discovers contracts, evaluates private plans, requests only due work, persists intent state, retries bounded failures, and emits notifications. |
| Security | Restricted Function Call keys, deterministic Rust rules, owner recovery controls, stable rule ordering, storage-abuse protections, 102 API/agent/contract/factory tests, a threat model, and five on-chain demonstration probes. |
| Privacy | Private delivery plans and notification contacts stay off-chain; the public audit minimizes its own fields; remaining NEAR visibility is explicitly disclosed. |
| Real-world utility | Business onboarding, worker portal, scheduled payroll, recipient lifecycle, reports, alerts, emergency pause/withdrawal, and delivery-state handling form one end-to-end operating workflow. |
| Business tooling | Each business gets an isolated contract, owner-discoverable dashboard, roster and limit management, CFO-style report, audit history, and role-specific documentation. |
| NEAR-native depth | Rust contracts, subaccounts, Function Call keys, Wallet Selector, NEP-413 signatures, final-state RPC evidence, NearBlocks proof links, NEAR AI, and a NEAR Intents adapter are used for distinct protocol-level jobs. |
| Technical quality | TypeScript across the application, Rust contract tests, API evidence tests, Playwright proof-path tests, reproducible security reports, CI, production builds, and deployed-WASM hash verification. |

## Honest limitations

- **Testnet only:** all contracts, wallets, balances, and assets described here are on NEAR testnet.
- **No fabricated cross-chain completion:** the adapter, preflight, persistence, and retry paths are implemented, but this release does not claim a public completed cross-chain payment without a `FILLED` solver reference.
- **Privacy-minimized, not fully confidential:** normal NEAR transaction arguments and current recipient policy configuration remain public.
- **Near-real-time polling, not streaming:** the UI and event watcher use explicit 10-second polling and focus refresh; there is no hidden simulated websocket feed.
- **AI is advisory:** model output cannot sign, mutate policy, set severity, manufacture measurements, or determine a security result.
- **Strict policy grounding can ask for clarification:** ambiguous prose is rejected instead of guessed. Explicit clauses such as `Daily limit: 500 NEAR.` are the safest input format.
- **Security probes are evidence, not a proof of absence:** the five fixed scenarios exercise the production evaluator, while the broader source-linked test suite and threat model remain the primary evidence.
- **Historical child bytecode is unchanged:** the active root and factory match the release WASMs; the two previously created registry children retain their original code. New factory deployments use the upgraded embedded payroll WASM.
- **Route measurements are point-in-time observations:** RPC availability and gas-unit prices are not promises about settlement time or total cost.

## Detailed demo flow for judges

No terminal required. Everything runs from the browser.

1. Open https://clavisapp.vercel.app — read the clearly labelled illustrative policy flow on the hero
2. Go to `/dashboard` — inspect the live read-only treasury, policy, roster, anomaly, and audit evidence without a wallet
3. Go to `/audit` — verify 9+ privacy-minimized on-chain decisions; salary fields are omitted from audit entries
4. Go to `/security` — inspect the versioned threat model, mapped tests, commit evidence, and limitations
5. Click "Open explorer" — confirm contract is live on NEAR testnet
6. Connect `clavis.testnet` on Meteor Wallet testnet to enable owner controls
   - Read the current final-block contract account balance and authorization-window usage; neither is presented as settlement runway
   - Read the current roster and configured routes from the same final-block snapshot
   - Click "Analyze with AI" on the anomaly alert
   - Click "Generate verified report" — Clavis reloads NEAR final state, composes the factual report, and uses AI only to prioritize a valid recommendation
   - Click "Run contract security probes" — 5 deterministic scenarios are rejected onchain and independently matched against the live audit ledger
7. Switch wallet to `arinze-worker1.testnet`
   - Go to `/worker` — "Hello, Worker 1." recognized from contract
   - Shows weekly cycle, primary route, cross-chain allocation
8. Go to `/guide` — business owner, worker, and developer guides
9. Go to `/setup` — 7-step factory deployment wizard

**Tracks:** `privacy` · `realworld` · `security` · `agents` · `business`

## License

MIT © 2026 Arinze
