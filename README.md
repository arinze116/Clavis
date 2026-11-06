# Clavis — Privacy-Minimized Payroll Controls on NEAR

> Give an AI agent enough authority to run payroll—and no authority to break the rules.

Clavis is a production-oriented NEAR testnet payroll platform for remote teams. Every business deploys an isolated payroll contract, an autonomous agent requests scheduled payments, and the contract independently enforces recipient, route, schedule, per-payment, personal-cap, and daily treasury policy.

- Live app: [https://clavisapp.vercel.app](https://clavisapp.vercel.app)
- Factory: [`factory.clavis.testnet`](https://testnet.nearblocks.io/address/factory.clavis.testnet)
- Root contract and provisioner: [`clavis.testnet`](https://testnet.nearblocks.io/address/clavis.testnet)
- Network: NEAR testnet only

## Live Demo

**Try it now:** https://clavisapp.vercel.app

| Resource | Link |
|---|---|
| Live app | https://clavisapp.vercel.app |
| Root contract | https://testnet.nearblocks.io/address/clavis.testnet |
| Agent key | https://testnet.nearblocks.io/address/clavis-agent.testnet |
| Factory | https://testnet.nearblocks.io/address/factory.clavis.testnet |
| Figma design | https://www.figma.com/design/jm1POnC0a492ZVAejkiBre |

## Production testnet capabilities

- Self-service business contract deployment under `*.clavis.testnet`
- Public read-only dashboard with owner-only mutation controls
- Worker registration checks, preferences, QR wallet sharing, and payment history
- Live NEAR Intents solver-relay submission with persisted status and retries
- Direct NEAR settlement only for native NEAR routes; unsupported cross-chain routes fail visibly
- Multi-contract payroll scheduling every 60 seconds
- Email notifications through Resend and Telegram Bot API notifications
- Per-contract anomaly state, audit state, intent state, and daily reports
- NEAR AI policy extraction, anomaly explanations, route advice, and CFO-style reports
- CI-backed threat model plus five deterministic browser probes recorded in the public contract log
- Interactive business, worker, and developer guides at `/guide`
- PM2 deployment scripts for Ubuntu 22.04 on Oracle Cloud
- Responsive React interface, loading skeletons, error boundaries, toasts, and legal pages

Clavis is intentionally testnet-only. Testnet assets have no monetary value.

## Architecture

```text
Business owner
    │
    ├── clavisapp.vercel.app/setup
    │       │
    │       ▼
    │  factory.clavis.testnet
    │       │
    │       ▼
    │  acmecorp.clavis.testnet
    │
    └── private payroll plan on the agent VPS
            │
            ▼
      TypeScript scheduler ── request_payment ──▶ business contract
            │                                      │
            │                              approve or reject
            │                                      │
            ├── notifications                      └── public audit decision
            ├── persisted intent status
            └── NEAR Intents relay
                    │
                    └── unsupported cross-chain route fails without substitution
```

The privacy-minimized public audit contains payment ID, timestamp, block height, outcome, and rejection reason. It does not store salary amounts, recipient hashes, wallet addresses, or destination routes. Normal NEAR transaction arguments and chain metadata remain public; see [docs/PRIVACY.md](docs/PRIVACY.md) for the exact boundary.

## Repository

```text
contract/   Payroll contract, factory contract, rules, audit, and Rust tests
agent/      Multi-contract scheduler, intents, notifications, reports, and tests
frontend/   React, TypeScript, Tailwind, wallet connection, dashboards, and setup
scripts/    Contract deployment, verification, VPS setup, deployment, and health checks
docs/       Privacy and security notes
```

## Requirements

- Node.js 20.19 or newer
- Rust stable and `wasm32-unknown-unknown`
- NEAR CLI RS
- NEAR testnet accounts for the root owner and restricted payroll agent

```bash
rustup target add wasm32-unknown-unknown
npm ci
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
npm run test:agent
npm run typecheck
npm run build
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
```

The proxy calls `https://cloud-api.near.ai/v1/chat/completions`, first attempts
`meta-llama/Llama-3.3-70B-Instruct`, and falls back to
`deepseek-ai/DeepSeek-V4.1-Flash-1017`. The browser never receives the API key.

The owner-only `run_security_audit()` contract method records five privacy-minimized rejected audit
entries without moving funds or changing treasury policy. These browser probes are demonstration
evidence; the versioned threat model and CI-mapped tests at `/security` are the primary security
evidence. The upgraded root and factory-embedded payroll WASM must be deployed before this control
is available on testnet.

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

```dotenv
TELEGRAM_BOT_TOKEN=123456:...
TELEGRAM_BOT_USERNAME=ClavisNotificationsBot
# Optional fallback destination for legacy per-business notifications:
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

The current deployment branch defaults to `feat/clavis-mvp`. Override it when promoting to `main`:

```bash
CLAVIS_BRANCH=main bash scripts/vps-setup.sh
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

## Demo flow for judges

No terminal required. Everything runs from the browser.

1. Open https://clavisapp.vercel.app — read the live policy engine card on the hero
2. Go to `/dashboard` — inspect the live read-only treasury, policy, roster, anomaly, and audit evidence without a wallet
3. Go to `/audit` — verify 9+ privacy-minimized on-chain decisions; salary fields are omitted from audit entries
4. Go to `/security` — inspect the versioned threat model, mapped tests, commit evidence, and limitations
5. Click "Open explorer" — confirm contract is live on NEAR testnet
6. Connect `clavis.testnet` on Meteor Wallet testnet to enable owner controls
   - Treasury: 9.94 NEAR live from contract
   - Payroll roster: 3 recipients across NEAR, Ethereum, BNB Chain
   - Click "Analyze with AI" on the anomaly alert
   - Click "Generate AI report" — NEAR AI generates a CFO-style summary
   - Click "Run contract security probes" — 5 deterministic scenarios, all rejected onchain; NEAR AI only summarizes the verified result
7. Switch wallet to `arinze-worker1.testnet`
   - Go to `/worker` — "Hello, Worker 1." recognized from contract
   - Shows weekly cycle, primary route, cross-chain allocation
8. Go to `/guide` — business owner, worker, and developer guides
9. Go to `/setup` — 7-step factory deployment wizard

**Tracks:** `privacy` · `realworld` · `security` · `agents` · `business`

## License

MIT © 2026 Arinze
