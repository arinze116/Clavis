# Clavis v0.3 release tracker

This file records current release work. Dated evidence reports remain historical records.

## Completed locally

- [x] Audit application, agent, contracts, APIs, deployment scripts, CI, and documentation.
- [x] Add on-chain milestone-reference idempotency.
- [x] Reconcile completed milestones after scheduler restart.
- [x] Require v0.3.0 or newer for production scheduler admission.
- [x] Persist notification completion only after successful delivery.
- [x] Enforce Testnet-only frontend and agent configuration.
- [x] Remove unsafe worker identity inference from display names.
- [x] Add v0.3 root, factory, and agent deployment verification scripts.
- [x] Add regression tests and refresh generated security evidence.
- [x] Align active documentation with source v0.3 and deployed v0.2 status.

## Release sequence

- [ ] Pass the complete local release gate.
- [ ] Push the feature branch and open the production-readiness pull request.
- [ ] Pass GitHub CI and security-evidence checks.
- [ ] Merge without bypassing branch protection.
- [ ] Deploy the exact merged commit to `clavis.testnet` and `factory.clavis.testnet` on Testnet.
- [ ] Deploy the exact merged commit to the VPS agent.
- [ ] Verify the production frontend deployment for the merged commit.
- [ ] Run post-deployment contract, agent, browser, responsive, and log checks.
- [ ] Update live deployment evidence and final release documentation.

## Residual limitations

- Cross-chain and split settlement remain disabled.
- Stale callback recovery relies on an owner-reviewed final receipt and explicit attestation.
- Notification delivery is at least once and can duplicate after a narrow crash window.
- Factory-created legacy v0.1 children have no repository-supported in-place owner upgrade path.
- Low-severity transitive advisories remain in the NEAR wallet dependency chain pending compatible upstream fixes.
- Large wallet and RPC browser chunks remain a performance maintenance item.
