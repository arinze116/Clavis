# Clavis — Private Cross-Chain Payroll on NEAR

> Give an AI agent enough authority to run payroll—and no authority to break the rules.

Clavis is a production-oriented NEAR testnet payroll platform for remote teams. Every business deploys an isolated payroll contract, an autonomous agent requests scheduled payments, and the contract independently enforces recipient, route, schedule, per-payment, personal-cap, and daily treasury policy.

- Live app: [https://clavisapp.vercel.app](https://clavisapp.vercel.app)
- Factory: [`factory.clavis.testnet`](https://testnet.nearblocks.io/address/factory.clavis.testnet)
- Root contract and provisioner: [`clavis.testnet`](https://testnet.nearblocks.io/address/clavis.testnet)
- Network: NEAR testnet only

## Production testnet capabilities

- Self-service business contract deployment under `*.clavis.testnet`
- Owner dashboard discovery through the factory contract
- Worker registration checks, preferences, QR wallet sharing, and payment history
- Live NEAR Intents solver-relay submission with persisted status and retries
- Direct NEAR testnet fallback when the solver has no supported quote
- Multi-contract payroll scheduling every 60 seconds
- Email notifications through Resend and Telegram Bot API notifications
- Per-contract anomaly state, audit state, intent state, and daily reports
- NEAR AI policy extraction, anomaly explanations, route advice, and CFO-style reports
- Browser-run five-scenario security audits recorded in the public contract log
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
                    └── direct NEAR fallback when no quote is available
```

The public audit contains payment ID, timestamp, block height, outcome, and rejection reason. It does not store salary amounts, recipient hashes, wallet addresses, or destination routes. Normal NEAR transaction arguments remain public; see [docs/PRIVACY.md](docs/PRIVACY.md) for the exact privacy boundary.

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
- NEAR testnet accounts for the root owner and shared agent

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
NEAR_AI_API_URL=https://cloud-api.near.ai/v1/chat/completions
# Optional: pin a catalog model instead of using Clavis's availability-aware selection.
NEAR_AI_MODEL=
```

`VITE_NEAR_AI_API_KEY` is accepted server-side for compatibility with the hackathon brief, but
`NEAR_AI_API_KEY` is preferred so the secret cannot be mistaken for a browser variable.
Clavis checks the live NEAR AI catalog, prefers the brief's Llama 3.3 model when available, and
falls back to a current NEAR-hosted instruction model if that catalog entry is retired.

The owner-only `run_security_audit()` contract method records five privacy-safe rejected audit
entries without moving funds or changing treasury policy. The upgraded root and factory-embedded
payroll WASM must be deployed before this control is available on testnet.

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

## Live NEAR Intents and fallback settlement

The agent calls the live relay at `https://solver-relay-v2.chaindefuser.com/rpc`.

Testnet asset identifiers:

- NEAR: `nep141:wrap.testnet`
- Ethereum USDC test route: `nep141:usdc.fakes.testnet`
- BNB test route: wrapped NEAR equivalent

Intent state is written atomically to `agent/data/intents.json` with `PENDING`, `FILLED`, and `FAILED` states. Failed submissions receive three retries after the initial attempt with a 30-second minimum backoff.

The public relay may return no quote for fake testnet assets. Clavis then logs `intent.direct_near_fallback` and sends the route's NEAR value directly to the recipient's NEAR testnet account.

```dotenv
INTENTS_CONTRACT_ID=intents.near
SOLVER_RELAY_URL=https://solver-relay-v2.chaindefuser.com/rpc
INTENTS_API_KEY=
SETTLEMENT_ACCOUNT_ID=clavis-agent.testnet
SETTLEMENT_PRIVATE_KEY=ed25519:...
```

The settlement key must never be exposed to the browser.

## Notifications

Notification failures are isolated with `Promise.allSettled`; email or Telegram downtime never stops payroll.

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

For one contract, use a Function Call access key restricted to `request_payment`. NEAR access keys target only one receiver, so the shared multi-contract testnet operator needs an explicitly enabled Full Access key:

```dotenv
NEAR_ACCOUNT_ID=clavis-agent.testnet
NEAR_PRIVATE_KEY=ed25519:...
ALLOW_FULL_ACCESS_AGENT=true
```

This exception is limited to the shared testnet operator. Contract authorization still prevents that account from invoking owner-only policy methods.

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

## License

MIT © 2026 Arinze
