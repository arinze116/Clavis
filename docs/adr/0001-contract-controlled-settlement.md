# ADR 0001: Contract-controlled native settlement and reconciled private plans

- Status: Accepted
- Date: 2026-11-09
- Languages: Rust for the on-chain authority; TypeScript for agent reconciliation and browser orchestration

## Context

The v0.1 design authorized payments on-chain but used a separate Full Access settlement account to move funds. A compromised host or settlement key could bypass contract authorization. The agent also received a successful authorization before persisting delivery state, so a crash could advance policy without a retry record.

Recipient management wrote public contract state and private plan state in different orders, allowing wallet cancellation or service failure to leave them inconsistent.

## Decision

1. The Rust payroll contract holds and transfers native NEAR.
2. `request_payment` accepts the NEAR recipient account, verifies its SHA-256 commitment, reserves policy state, and creates the transfer promise.
3. Approval and audit finalization occur only in the successful transfer callback.
4. Failed transfers roll back daily spend and recipient schedule state.
5. Cross-chain and split execution fail closed until custody can remain contract-controlled end to end.
6. The active TypeScript agent contains no external settlement signer.
7. Private-plan changes use persisted pending operations and commit only after exact final-chain reconciliation.
8. The React application stages first, signs the public transaction second, and requests immediate reconciliation third; background reconciliation handles crashes and restarts.
9. The UI reads contract versions and distinguishes v0.2 settlement guarantees from legacy authorization-only deployments.
10. A callback that remains unresolved is locked for ten minutes. The owner may then resolve it with a public NEAR transaction hash and an explicit delivered/failed attestation; the contract emits a `payment_recovery` event.

## Consequences

- A compromised agent host can request only payments allowed by contract policy and cannot redirect native funds without breaking the recipient commitment check.
- A contract-account Full Access deployment key remains outside this enforcement boundary. The upgraded root key is isolated from the agent runtime in a manually unlocked Secret Service keychain; factory-created v0.2 children from this source have no access keys.
- Approval cannot be stranded between contract authorization and agent persistence.
- Native throughput is serialized to one in-flight transfer per payroll contract.
- Callback uncertainty fails closed during the finality window. Recovery restores availability but depends on correct owner verification of the referenced receipt; a false failure attestation can enable a duplicate retry.
- Cross-chain routes are unavailable in this release.
- The root v0.1 contract required, and has now completed, an explicitly approved deployment-key upgrade plus stored-owner-checked migration; the factory must still be upgraded before creating v0.2 children.
- Factory-created v0.1 children have no deployment key or legacy self-upgrade entry point, so their policy owner cannot migrate them in place through this repository and may need to replace them.
- Private-plan changes may remain visibly pending while RPC or service reconciliation is unavailable, but the previous active plan stays consistent.
