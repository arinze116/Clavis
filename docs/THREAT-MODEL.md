# Clavis threat model

## Scope

Clavis is Testnet software. Source v0.3 makes the payroll contract the final policy and native-settlement authority and adds on-chain milestone-reference replay protection. The current public root and factory remain v0.2.0 until release deployment.

## Adversaries

1. An unauthenticated internet caller.
2. A stolen or malfunctioning restricted agent key.
3. A compromised agent host.
4. A malicious recipient attempting to redirect payment.
5. A replaying or restarted scheduler.
6. An operator supplying malformed configuration.
7. A chain observer correlating public data.
8. A compromised Full Access deployment key.
9. A malicious or unavailable wallet, RPC provider, indexer, AI provider, or notification provider.

## Enforced invariants

- Only the configured agent can request payment; owner-only methods reject other callers.
- Full Access and over-broad scheduler keys fail runtime verification.
- The v0.3 scheduler rejects contracts older than v0.3.0.
- Unknown, suspended, early, off-hours, over-cap, over-limit, wrong-route, and commitment-mismatched requests fail on-chain.
- Native funds leave the payroll contract, not an external settlement wallet.
- Approval is written only after transfer success.
- Transfer failure restores reserved daily spend and schedule state.
- One native settlement may be pending per contract.
- Recipient mutation and emergency withdrawal are blocked while settlement is pending.
- A milestone requires a validated reference; a successfully settled recipient/reference pair cannot settle again.
- Cross-chain and split execution fail closed before policy state advances.
- Private-plan changes remain staged until final public state matches.
- Notification events remain retryable until at least one channel succeeds.
- Arithmetic overflow and partial security-audit writes fail closed.

## Residual risks

- No independent third-party audit has been completed.
- Mainnet is unsupported.
- Standard NEAR transaction inputs and metadata are public.
- Unsalted hashes of predictable account IDs are commitments, not anonymity.
- Agent-host compromise can expose private plans and notification contacts.
- A Full Access payroll-account key can redeploy code or move funds outside contract logic. Root and factory keys are isolated from the scheduler, but full VPS compromise remains a custody risk.
- Factory-created v0.1 children have no current in-place owner upgrade path.
- Stale callback recovery depends on correct owner interpretation of a final receipt. A false failed-delivery attestation can permit a duplicate retry.
- At-least-once notification semantics can duplicate an alert after a narrow crash window.
- A factory deployment interrupted after funds move can leave a pending record that cannot be safely auto-refunded without trustworthy receipt interpretation.
- Employer audit events omit recipient identity, so worker-specific history cannot be reconstructed from those events alone.

## Reproducible evidence

```bash
bash scripts/verify.sh
```

The generated case map is in [generated/security-report.md](generated/security-report.md). It links threats to deterministic tests and records source hashes. It is repository evidence, not an external audit.

## Reporting vulnerabilities

Do not publish credentials or weaponized exploit details in a public issue. Contact the repository owner privately with the affected revision, prerequisites, reproduction steps, impact, and suggested mitigation.
