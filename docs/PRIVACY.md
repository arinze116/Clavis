# Clavis privacy boundary

Clavis provides a privacy-minimized audit, not confidential blockchain execution.

## Public by design

- contract owner and authorized agent accounts;
- configured limits, pause state, recipient labels, caps, schedules, and routes;
- standard transaction caller, function arguments, timing, gas, and receipts;
- payment ID, timestamp, block height, outcome, and rejection reason;
- public-safe anomaly descriptions.

For v0.2 native settlement, the recipient account and amount are transaction inputs and therefore observable even though they are omitted from the dedicated audit event.

## Omitted from the Clavis audit entry

- payment amount;
- recipient commitment and wallet address;
- display name;
- destination chain, token, and address;
- private scheduled amount and report totals.

Omission reduces repeated disclosure in the application’s audit ledger; it does not erase transaction data from NEAR.

## Access-controlled agent storage

The agent stores:

- scheduled payment amount;
- worker NEAR account;
- destination configuration;
- notification email or Telegram chat ID;
- staged private-plan operations;
- report and deduplication state.

Files are created with owner-only permissions where supported, updated through atomic replacement, ignored by Git, and never returned in plan-management responses. This boundary depends on host and operator security and is not cryptographic confidentiality.

There is no `CONFIDENTIAL_EXECUTOR_URL` implementation and no dry-run confidential executor in this repository.

## Consistency protection

Private recipient changes are staged and become active only after final on-chain state matches. Wallet cancellation, service failure, or browser termination therefore does not overwrite the previous active plan. Pending operations survive service restart and expire after 24 hours.

## Worker view limitation

Audit entries intentionally omit recipient identity. The worker portal therefore shows employer-wide decisions and cannot prove that an entry belongs to the connected worker.

## Hardening path

1. Replace predictable unsalted account hashes with random or salted commitments.
2. Move labels, caps, schedules, and routes into encrypted or confidential state.
3. Execute policy checks inside a verifiable confidential runtime.
4. Publish only an attested decision commitment.
5. Add authenticated worker-specific delivery records without weakening audit minimization.
