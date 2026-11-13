# Clavis Markdown documentation audit

Date: 2026-11-13

Baseline: `d6d0a6944498ed07ebe4faaeac1a6edd399ed4d9` (`origin/main`)

Scope: every tracked Markdown file plus relevant untracked Markdown present in the workspace

## Audit method

The audit compared documentation with the Rust payroll and factory contracts, TypeScript agent and scheduler, React routes, serverless APIs, package scripts, environment example, deployment tooling, CI workflows, tests and generated security-evidence script. Historical reports were assessed as dated evidence rather than current implementation claims.

Status terms in this report:

- **Corrected**: a material or consistency correction was made.
- **Reviewed**: checked against the implementation or its historical evidence and left unchanged.
- **Generated**: regenerated through `scripts/security/generate-security-report.mjs`; not edited by hand.
- **Excluded**: pre-existing untracked user work reviewed for conflicts but not added to this audit branch.

## Material findings

1. Cross-chain execution is rejected by `request_payment` before policy state advances.
2. The production scheduler requires one 100% native NEAR route and rejects split or non-native plans before submission.
3. The contract independently accepts split policy of up to three supported routes totalling 100%. Any configured split leg counts as registered, but native settlement transfers the full requested amount and does not apply the leg's percentage.
4. A caller holding the configured agent key can therefore bypass scheduler preflight and request the full amount through a native leg in a mixed split. Existing tests prove pure cross-chain rejection and split configuration acceptance, not contract-level mixed-split fail-closed behaviour.
5. Pending settlement does not freeze all policy mutation. It blocks mutation or removal of the settling recipient and blocks emergency withdrawal globally. Other recipient additions and owner-policy changes remain callable.
6. Repository tests and generated security evidence are not an independent third-party audit.
7. No tracked Markdown or frontend source retained the standalone project X link. One stale Playwright expectation still required it and was removed to match the owner's explicit no-X decision.

## Tracked Markdown disposition

| File | Disposition |
| --- | --- |
| `README.md` | Corrected settlement and split-enforcement claims. |
| `DEMO.md` | Corrected split boundary and British English. |
| `HACKATHON.md` | Corrected security model and limitations. |
| `SECURITY.md` | Corrected core invariant and documented the direct-call split gap. |
| `SUBMISSION.md` | Corrected product boundary and British English. |
| `TASKS.md` | Corrected residual split limitation. |
| `demo/RECORDING_GUIDE.md` | Reviewed; British English corrections only. |
| `demo/STORYBOARD.md` | Reviewed; British English corrections only. |
| `docs/ARCHITECTURE.md` | Added the scheduler, contract and direct-call route boundary. |
| `docs/PRIVACY.md` | Reviewed; British English correction only. |
| `docs/THREAT-MODEL.md` | Corrected pending-mutation and split invariants. |
| `docs/adr/0001-contract-controlled-settlement.md` | Recorded the implementation divergence from the intended split invariant. |
| `docs/adr/0002-meteor-wallet-profile-and-key-separation.md` | Reviewed; historical decision remains accurate in context. |
| `docs/adr/0003-dedicated-near-secret-service-keychain.md` | Reviewed; British English corrections only. |
| `docs/adr/0004-clavis-brand-asset-pipeline.md` | Reviewed; unchanged. |
| `docs/adr/0005-on-chain-milestone-idempotency.md` | Reviewed; unchanged. |
| `docs/brand/BRAND-BRIEF.md` | Reviewed; British English and Testnet capitalisation corrected. |
| `docs/brand/BRAND-SYSTEM.md` | Reviewed; British English correction only. |
| `docs/generated/security-report.md` | Generated from the corrected generator. |
| `docs/reports/clavis-complete-feature-inventory.md` | Corrected route-support and split-safety status. |
| `docs/reports/clavis-final-4k-demo-release-20261113.md` | Reviewed; British English correction only. |
| `docs/reports/clavis-near-factory-signer-connection-20261109.md` | Reviewed; British English corrections only. |
| `docs/reports/clavis-near-factory-signer-connection-20261110.md` | Reviewed; British English corrections only. |
| `docs/reports/clavis-near-factory-signer-identity-investigation-20261109.md` | Reviewed; unchanged historical evidence. |
| `docs/reports/clavis-near-factory-signer-preflight-20261109.md` | Reviewed; British English corrections only. |
| `docs/reports/clavis-near-factory-signer-recovery-20261109.md` | Reviewed; British English corrections only. |
| `docs/reports/clavis-near-signer-connection-20261109.md` | Reviewed; British English correction only. |
| `docs/reports/clavis-near-signer-preflight-20261109.md` | Reviewed; British English correction only. |
| `docs/reports/clavis-near-testnet-wallet-setup-20261109.md` | Reviewed; British English corrections only. |
| `docs/reports/clavis-v02-final-acceptance-20261110.md` | Reviewed; British English correction only. |
| `docs/reports/clavis-v02-full-execution-20261109.md` | Reviewed; British English corrections only. |
| `docs/reports/clavis-v02-publication-package-20261109.md` | Reviewed; British English corrections only. |
| `docs/reports/clavis-v03-production-release-20261112.md` | Added a dated correction for the newly identified split gap. |
| `tests/README.md` | Corrected test-coverage wording and British English. |

This report is an additional tracked Markdown file created by the audit.

## Untracked Markdown reviewed and excluded

These files existed before the branch work. They belong to separate demo-production work and were not staged or rewritten:

- `demo/clavis-desktop-tutorial-178s/REVIEW.md`
- `demo/clavis-desktop-tutorial-178s/SPEC.md`
- `demo/clavis-desktop-tutorial-178s/STORYLINES.md`
- `demo/clavis-e2e-179s/SPEC.md`
- `demo/clavis-e2e-179s/STORYLINES.md`
- `demo/final-video/AGENTS.md`
- `demo/final-video/CLAUDE.md`
- `demo/final-video/REVIEW.md`
- `demo/final-video/SPEC.md`
- `demo/final-video/STORYLINES.md`
- `docs/adr/0002-full-desktop-demo-production.md`
- `docs/reports/clavis-final-4k-demo-production-20261112.md`
- `docs/reports/clavis-final-demo-production-20261110.md`
- `docs/reports/clavis-final-submission-readiness-20261111.md`

## Remaining implementation discrepancy

The split-policy gap cannot be corrected by documentation. Contract enforcement would require an application-code change and new contract tests, which are outside this documentation audit. Until then, documentation must distinguish production scheduler validation from the weaker contract-level guarantee.

## Validation completed

- `bash scripts/verify.sh` passed after regeneration: 34 payroll-contract, 3 factory, 12 signer, 55 API, 75 agent and 8 Playwright tests, plus formatting, Clippy, type checks, builds, deployment-script syntax, security-evidence freshness, dependency threshold and whitespace checks.
- Generated evidence reports 31 mapped threats and 187 repository tests. The split limitation is produced by the generator and appears in Markdown, JSON and the frontend evidence module.
- Local Markdown targets, image paths and internal anchors were checked across all 35 final tracked Markdown files.
- GitHub's Markdown API rendered `README.md` successfully.
- Ninety-one distinct external URLs were checked. Eighty-five responded to ordinary HTTP checks; the remaining NEAR RPC endpoints rejected ordinary GET/HEAD requests but each returned `chain_id: testnet` to a JSON-RPC `status` request.
- The scoped credential-pattern scan found only explanatory references to secrets, not secret values.
- The dependency gate passed with 17 known low-severity transitive `elliptic` advisories. The suggested automatic fix is a breaking `near-api-js` change and was not applied.
