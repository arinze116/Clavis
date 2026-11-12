# ADR 0005: On-chain milestone idempotency and retryable notifications

- Status: Accepted
- Date: 2026-11-12
- Languages: Rust for settlement invariants; TypeScript for scheduling, reconciliation, and notification delivery

## Context

Clavis v0.2 kept native NEAR settlement inside the payroll contract, but a one-time milestone was marked complete only in agent storage. A process restart after final settlement but before the local write could submit the same milestone again. Notification events were also persisted as handled before any configured channel confirmed delivery, which could permanently lose an alert.

## Decision

1. Every milestone payment carries an owner-approved reference containing 1–128 ASCII letters, digits, dots, underscores, colons, or hyphens.
2. The payroll contract rejects a milestone without a reference and rejects a recipient/reference pair already settled.
3. A reference becomes complete only in the successful native-transfer callback.
4. The scheduler queries the contract before submission and reconciles completed references into local state after a restart.
5. The production scheduler admits only payroll contracts reporting v0.3.0 or newer.
6. Notification claims remain in memory while delivery is in flight. An event is persisted as complete only after at least one configured delivery channel succeeds.
7. Failed or skipped notification deliveries remain eligible for retry after the current attempt and after process restart.

## Consequences

- Milestone replay protection no longer depends on one agent process or one local state file.
- The contract stores a small additional key for each successfully settled milestone.
- Weekly and biweekly schedules retain their existing timestamp-based enforcement.
- Notification delivery is at least once. A crash after provider acceptance but before the completion write may cause a duplicate notification, but an unsuccessful attempt does not silently discard the event.
- v0.2 contracts remain readable and retain contract-controlled native settlement, but they are not safe targets for the v0.3 production scheduler.
