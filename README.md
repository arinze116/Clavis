# Clavis — Private Cross-Chain Payroll on NEAR

> Give an AI agent enough authority to run payroll—and no authority to break the rules.

Clavis is a NEAR testnet payroll protocol for remote teams. An autonomous agent watches payment schedules and requests authorizations, while a Rust smart contract independently enforces recipient, route, schedule, per-payment, personal-cap, and daily treasury policy. Approved authorizations are converted into retryable cross-chain intent envelopes.

The public audit log proves every decision without including payment amounts, recipient identifiers, names, or destination chains.

## Why Clavis

- **Rule-bound automation:** the agent cannot edit policy or bypass contract checks.
- **Protocol-level key security:** the runtime rejects Full Access agent keys and accepts only a Function Call Key scoped to `request_payment` on the Clavis contract.
- **Cross-chain delivery:** one authorization can produce one or more NEAR Intent routes.
- **Failure-safe agent:** approved deliveries are persisted before submission and retried after relay failures or restarts.
- **Privacy-shaped audit:** public decisions contain only payment ID, timestamp, block height, outcome, and rejection reason.

## Current implementation status

| Capability | Status |
| --- | --- |
| Rust rules contract and public audit | Implemented |
| All eight PRD policy checks | Implemented and unit-tested |
| Onchain schedule and destination-route checks | Implemented as security extensions |
| Function Call Key verification | Implemented in the agent |
| Agent scheduler, anomaly detection, reports, retries | Implemented |
| Responsive owner, worker, setup, and audit UI | Implemented |
| Cross-chain intent construction | Implemented |
| Intent submission | Dry-run or configurable confidential executor adapter |
| True private execution on NEAR testnet | Requires an official confidential runtime/executor integration |

Important: a normal NEAR function call exposes its arguments. The current direct-testnet fallback therefore does **not** claim that `recipient_hash`, `amount`, `chain`, or `token` are hidden from transaction inspection. The audit record is private-shaped, but end-to-end salary confidentiality requires moving policy execution into the confidential runtime. See [Privacy model](docs/PRIVACY.md).

## Architecture

```text
Private payroll plan                 Public policy state
amounts + destinations              limits + schedules + allowlist
          │                                  │
          ▼                                  ▼
  TypeScript payroll agent ──request──▶ Rust contract
          │                              │
          │                       approve / reject
          │                              │
          ├── persist delivery queue     └── public audit, no amount/recipient
          │
          ▼
 Confidential executor adapter
          │
          ▼
     NEAR Intents → worker chain
```

The contract adds two protections omitted from the original eight-rule pseudocode:

1. A weekly or biweekly recipient cannot be paid early.
2. The requested chain/token pair must already be registered for that recipient.

Without these checks, a stolen agent key could repeatedly pay an allowed recipient or redirect an otherwise valid authorization.

## Repository

```text
contract/   Rust NEAR contract, rules, treasury, audit, anomalies, unit tests
agent/      TypeScript scheduler, restricted-key verification, intents, reports
frontend/   React + TypeScript + Tailwind dashboard and onboarding
scripts/    Reproducible deploy, setup, payment, attack, and verification flows
docs/       Privacy and security design notes
```

## Quick start

### Prerequisites

- Node.js 20 or newer
- Rust and the `wasm32-unknown-unknown` target
- NEAR CLI RS
- Existing NEAR testnet accounts for the owner, contract, and agent

```bash
rustup target add wasm32-unknown-unknown
npm ci
cp .env.example .env
cp .env.example agent/.env
cp .env.example frontend/.env
```

Replace every placeholder in `.env` and `agent/.env`. Never use an agent Full Access key.

### Verify locally

```bash
./scripts/verify.sh
```

Or run suites separately:

```bash
cargo test --manifest-path contract/Cargo.toml
npm run test:agent
npm run typecheck
npm run build
```

### Deploy to NEAR testnet

Log the contract account into NEAR CLI, then run:

```bash
./scripts/deploy.sh
```

The script builds the optimized WASM, deploys it, and initializes a 100 NEAR daily limit with a 20 NEAR per-payment limit.

### Create the restricted agent key

```bash
./scripts/create-function-key.sh
```

The command creates a Function Call Key on the agent account with:

- receiver: the configured Clavis contract;
- method: `request_payment` only;
- allowance: `0.25 NEAR` for transaction fees.

Copy the printed private key into `agent/.env` as `NEAR_PRIVATE_KEY`. The agent refuses to start if the key has Full Access or broader method permissions.

### Initialize deterministic demo data

```bash
./scripts/setup.sh
```

This adds three recipients and writes an ignored, permission-restricted private payroll file at `agent/config/payroll.local.json`.

### Run one payroll cycle

```bash
./scripts/test-payment.sh
```

With `DRY_RUN_INTENTS=true`, intent envelopes are constructed and deterministically acknowledged without pretending funds moved. Set `DRY_RUN_INTENTS=false` and configure `CONFIDENTIAL_EXECUTOR_URL` to use a real executor adapter.

### Simulate a compromised agent

```bash
./scripts/simulate-attack.sh
```

The restricted agent key requests payment for an unapproved commitment. The expected contract response is `Recipient not approved`, and the rejection appears in the public audit.

### Run the interface

```bash
npm run dev:frontend
```

Open `http://localhost:5173`.

Routes:

- `/` — product landing page
- `/dashboard` — owner-only contract controls
- `/worker` — connected worker profile
- `/audit` — public decision log
- `/setup` — owner configuration wizard

## Rules engine

`request_payment` evaluates policy in this order:

1. Contract is not paused.
2. Caller is the configured agent.
3. Recipient commitment exists.
4. Recipient is active.
5. Amount is positive and inside the global per-payment limit.
6. Amount is inside the recipient's personal cap.
7. The daily counter resets after 24 hours.
8. Projected daily spend remains inside the daily limit.
9. The recipient's onchain schedule is due.
10. The destination chain/token route is registered.

Every decision made for the authorized agent receives a sequential payment ID. Calls from arbitrary public accounts are rejected without writing state, which prevents audit-storage exhaustion. No amount, recipient commitment, display name, or route is written to `AuditEntry` or its event.

## Agent safety model

The agent deliberately has less authority than the contract owner:

- it cannot add, edit, suspend, or remove recipients;
- it cannot change limits or schedules;
- it cannot pause, unpause, withdraw, or upgrade the contract;
- it cannot submit a route that the owner did not register;
- its key cannot call any method except `request_payment`;
- it terminates at startup if its key is over-privileged.

The private payroll plan is validated on every cycle. Destination percentages must total 100, duplicate recipient commitments are rejected, and unsupported chain/token pairs stop the cycle. Manual payments use stable milestone IDs, so one ready milestone cannot be paid repeatedly across polling cycles.

## Anomaly coverage

- More than 10 requests in one hour
- Activity between 00:00 and 04:00 UTC
- Daily limit at or above 90%
- Private destination fingerprint changed between cycles
- Same recipient requested twice inside one minute

The contract records public-safe anomalies for request patterns and registered route changes. The agent also keeps private anomaly context for owner reports.

## Demo flow for judges

1. Open `/dashboard` and show the enforced limits and approved roster.
2. Run `./scripts/test-payment.sh` and watch an approved decision appear.
3. Open `/audit`; point out that the decision contains no salary or recipient data.
4. Run `./scripts/simulate-attack.sh`; show the policy rejection.
5. Inspect the agent account key on a NEAR explorer and show its single allowed method.
6. Switch the intent adapter from dry-run to the hackathon-provided confidential executor for the cross-chain settlement demo.

## Hackathon tracks

`privacy` · `realworld` · `security` · `agents` · `business`

See [HACKATHON.md](HACKATHON.md) for judging notes and the sister project link.

## Design

- [Figma source](https://www.figma.com/design/jm1POnC0a492ZVAejkiBre)
- Desktop-first hackathon demo with responsive tablet/mobile layouts
- Visual direction: institutional security with a warm, human payroll experience

## License

MIT © 2026 Arinze
