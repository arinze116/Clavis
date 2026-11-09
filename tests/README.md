# Test layout

Tests live beside the code they exercise:

- `contract/src/tests.rs` covers policy rules, native-transfer callback finalization and rollback, migration, treasury reserves, schedule enforcement, route fail-closed behavior, audit events, and security probes.
- `contract/src/factory.rs` covers factory authorization, pending-deployment constraints, and failed-provision cleanup.
- `agent/src/*.test.ts` covers restricted credentials, native-only preflight, scheduler crash safety, legacy intent deduplication, durable private-plan reconciliation, notifications, anomaly detection, and state persistence.
- `tests/api/*.test.ts` covers AI evidence grounding, same-origin RPC restrictions and failover, notification proxying, and event-derived audit transaction mapping.
- `tests/e2e/public-proof.spec.ts` covers the public claim boundary, legacy-version labels, privacy wording, source-linked security limitations, responsive behavior, and delayed-load mobile navigation.

Run the complete documented release gate from [`README.md`](../README.md). `npm test` runs the API, agent, and payroll-contract suites; factory tests, WASM builds, Playwright, dependency audit, formatting, and diff checks are separate explicit gates.
