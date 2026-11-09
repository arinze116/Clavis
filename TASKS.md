# Clavis v0.2 release completion

This file tracks the current release truth. Historical v0.1 test counts and implementation plans are intentionally removed because they do not prove the v0.2 settlement model.

## Source acceptance status

| ID | Requirement | Source status | Evidence boundary |
| --- | --- | --- | --- |
| S1 | Contract-controlled native settlement | Implemented | The payroll contract transfers native NEAR, commits approval after callback success, and rolls reserved state back on failure. |
| S2 | No authorization-to-persistence crash gap | Implemented | Transfer and final decision remain in the NEAR promise graph; the agent records only the settled result. |
| S3 | Stable mobile navigation | Implemented | Business, Worker, Audit, and Setup each retain one `AppShell` across loading and content states. |
| S4 | Consistent recipient changes | Implemented | Private upserts and removals are durably staged and become active only after exact final-chain reconciliation. |
| S5 | Truthful settlement documentation | Implemented locally | Cross-chain, split, dry-run, confidential-executor, and external-settlement claims match the fail-closed source behavior. |
| S6 | Honest worker history | Implemented | The portal labels audit data as employer-wide because entries omit recipient identity. |
| S7 | Deterministic explorer links | Implemented | Final transaction events map emitted `payment_id` values; block height and array order are never used as identity. |
| S8 | Version-aware web claims | Implemented | Legacy deployments receive authorization-only warnings; setup blocks a legacy factory. |

## Local release gate

The authoritative commands and latest recorded counts are maintained in [`README.md`](README.md) and [`SUBMISSION.md`](SUBMISSION.md). Before any commit or deployment, all of these must pass on the final working tree:

```bash
cargo fmt --check --manifest-path contract/Cargo.toml
cargo test --manifest-path contract/Cargo.toml
bash scripts/build-contracts.sh
cargo test --manifest-path contract/Cargo.toml --package clavis-factory
npm run typecheck
npm run test:api
npm run test:agent
npm run build
npm run demo:typecheck
npm run test:e2e:built
npm audit --omit=dev --audit-level=moderate
git diff --check
```

Regenerate the source-linked security report after the final test run and verify that its source hashes, line numbers, threat mappings, and total test count match the same working tree.

## Approval-gated release work

- [ ] Upgrade `clavis.testnet` and call owner-authorized `migrate`.
- [ ] Upgrade `factory.clavis.testnet`.
- [ ] Deploy the verified frontend and agent revision.
- [ ] Verify deployed code hashes and contract versions.
- [ ] Execute and verify native settlement and rollback evidence on testnet.
- [ ] Run two uninterrupted deployed browser rehearsals.
- [ ] Capture and inspect deployed desktop, tablet, and mobile screenshots.
- [ ] Record, render, inspect, and publish the final demo video.
- [ ] Add final public URLs to the submission documents.
- [ ] Push or publish only after explicit owner approval.

Until those items are evidenced, the public root and factory remain legacy and v0.2 must be described as verified source behavior, not deployed behavior.
