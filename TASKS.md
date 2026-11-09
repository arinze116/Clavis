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
bash scripts/verify.sh
```

Regenerate the source-linked security report after the final test run and verify that its source hashes, line numbers, threat mappings, and total test count match the same working tree.

## Approval-gated release work

- [x] Upgrade `clavis.testnet` and call owner-authorized `migrate`.
- [ ] Upgrade `factory.clavis.testnet`.
- [x] Deploy and verify the production frontend at <https://clavisapp.vercel.app>.
- [x] Deploy the verified v0.2 agent revision against the upgraded root.
- [x] Verify the v0.2 root and legacy factory code hashes and contract-version boundary.
- [x] Verify the upgraded root v0.2 code hash and contract version.
- [x] Execute and verify two native settlements plus rollback and rejection evidence on testnet.
- [x] Run two uninterrupted deployed browser rehearsals.
- [x] Capture and inspect deployed desktop, tablet, and mobile screenshots.
- [x] Record, render, inspect, and publish the historical pre-deployment source-and-test demo.
- [ ] Publish a new live-v0.2 demo and the final guide/explorer fixes after explicit owner approval.
- [x] Add final public app, repository, CI, contract, release, and demo URLs to the submission documents.
- [x] Push and publish only after explicit owner approval.

The factory upgrade requires its distinct Full Access signer, which is not present in the secure Clavis keychain and does not match the imported owner or worker identities. Publication of the remaining frontend/demo changes is separately approval-gated. The available agent key remains restricted to `request_payment` and cannot deploy code.
