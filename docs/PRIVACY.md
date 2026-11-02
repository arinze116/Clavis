# Privacy model

Clavis separates **public policy evidence** from **private payroll data**.

## Public by design

- Contract owner and authorized agent account
- Policy limits and active/paused state
- Recipient configuration in the current hackathon contract
- Transaction caller and arguments for direct NEAR calls
- Payment ID, timestamp, block height, approval/rejection, and rejection reason
- Public-safe anomaly descriptions

## Kept out of the audit record

- Payment amount
- Recipient commitment, wallet address, and display name
- Destination chain and token
- Intent destination address
- Payroll report totals

## Kept in private agent storage

- Scheduled payment amount
- Destination addresses
- Cross-chain allocation
- Delivery status and retry state
- Owner payroll reports

Files containing this data are created with owner-only permissions where supported and are excluded by `.gitignore`.

## Confidential execution boundary

The agent exposes a `CONFIDENTIAL_EXECUTOR_URL` adapter. In real mode, sensitive intent envelopes are sent over TLS to that executor and never logged. In dry-run mode, the agent produces a deterministic receipt for testing without claiming settlement.

This adapter alone does not hide the arguments of the preceding direct `request_payment` NEAR transaction. End-to-end confidentiality requires the rules engine or a verifiable policy proof to execute inside the official confidential runtime. The current repository intentionally labels that integration as pending rather than presenting a public call as private.

## Production hardening path

1. Replace wallet-address SHA-256 values with random or salted commitments managed by a confidential registry.
2. Move recipient names, caps, schedules, and routes into encrypted/confidential state.
3. Execute policy checks in the confidential runtime.
4. Publish only a proof or attested decision commitment to the public audit contract.
5. Bind settlement receipts to the payment ID without publishing the destination.
6. Require wallet-signature authentication for worker earnings and delivery history.
