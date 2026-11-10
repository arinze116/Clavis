# NEAR Hackathon 2026

Clavis targets the privacy, real-world, security, agents, and business tracks.

## NEAR-native differentiators

- Contract-scoped Function Call keys restrict each scheduler to `request_payment` on one payroll contract.
- Source contract v0.2 holds and transfers native NEAR, verifies the recipient commitment, and records approval only after callback success.
- NEAR subaccounts provide isolated business state and treasury boundaries.
- NEP-413 signatures authorize private-plan staging without exposing owner keys to the service.
- Final-state RPC and contract events provide versioned, reproducible evidence.
- Audit entries minimize repeated payroll fields while the product clearly discloses normal transaction visibility.

Cross-chain execution is disabled in this release. There is no confidential-executor adapter or dry-run relay claim.

## Highest-value demo moments

1. A restricted scheduler requests a due native payment.
2. The payroll contract transfers its own funds and commits approval only after success.
3. A wrong recipient account fails the commitment check.
4. A failed transfer restores spend and schedule state.
5. A private recipient change remains staged until exact on-chain reconciliation.
6. The public audit opens the transaction that emitted the exact payment ID.
7. The worker portal states that history is employer-wide because entries omit recipient identity.

## Deployment status

The public root and factory are live on v0.2.0. The backend agent settled both designated workers on the root, and the factory created `clavis-v02-e2e-20261110.clavis.testnet` with reviewed v0.2 code. Factory registration, ownership, permissions, settlement, rollback, duplicate, insufficient-funds, and unauthorized paths are verified on Testnet. Cross-chain execution remains disabled.

## Builder

- Arinze
- X: [@useClavis_](https://x.com/useClavis_)
- Network: NEAR testnet only
