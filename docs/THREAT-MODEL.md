# Clavis threat model

## Scope

Clavis is testnet software. During normal contract execution, source contract v0.2 is the final authority for policy and native NEAR settlement. The scheduler decides when to request a payment but has only a contract-scoped Function Call key. The owner wallet controls policy and emergency administration; code deployment requires separate Full Access contract-account authority that sits outside contract enforcement.

The current public root and factory are legacy v0.1 deployments until explicitly upgraded. A deployment receives the v0.2 guarantees only when `contract_version` reports v0.2.0 or newer.

## Adversaries

1. An unauthenticated internet caller.
2. A stolen or malfunctioning restricted agent key.
3. A compromised agent host.
4. A malicious recipient attempting to redirect payment.
5. A replaying or restarted service.
6. An operator supplying malformed private configuration.
7. A chain observer correlating public transaction inputs and metadata.
8. A compromised contract-account deployment key.

## Enforced invariants

- Unauthorized callers cannot append payment audit entries.
- Full Access and over-broad agent keys fail runtime verification.
- Legacy or malformed contract versions fail scheduler admission before any payment request.
- Unknown, suspended, early, off-hours, over-cap, over-limit, and wrong-route requests fail on-chain.
- The native destination account must hash to the owner-approved recipient commitment.
- Native funds leave the payroll contract, not a separate settlement wallet.
- Approval is appended only after successful transfer callback.
- Transfer failure rolls back reserved daily spend and schedule state.
- No public method accepts an operator-supplied transfer result; callback uncertainty fails closed instead of risking a duplicate retry.
- Mutation of the in-flight recipient and emergency withdrawal are blocked during pending settlement.
- Cross-chain and split execution fail closed before policy state advances.
- Private-plan upserts and removals remain staged until final public state matches.
- Pending private changes survive restart and expire without changing the active plan.
- Arithmetic overflow and partial security-audit writes fail closed.
- Processed notification events and legacy filled-delivery records are deduplicated.

## Reproducible evidence

```bash
cargo test --manifest-path contract/Cargo.toml
cargo test --manifest-path contract/Cargo.toml --package clavis-factory
npm exec --workspace=@clavis/agent -- vitest run --reporter=json --outputFile=../artifacts/security-evidence/vitest.json
node scripts/security/generate-security-report.mjs \
  --status passed \
  --vitest-report artifacts/security-evidence/vitest.json \
  --frontend-output frontend/src/data/securityEvidence.generated.ts
```

The generator resolves every mapped test marker, records current source hashes and line numbers, counts the successful Rust and agent suites, and fails if a mapped test disappears. The generated report is the authoritative case count.

## Known limitations

- No independent third-party audit has been completed.
- Testnet only; do not custody mainnet funds.
- The live root and factory are legacy until upgraded.
- Factory-created v0.1 children lack an in-place owner upgrade path and may require replacement.
- Cross-chain execution is disabled.
- Standard NEAR transaction inputs and metadata remain public.
- Unsalted hashes of predictable account IDs are weak anonymity.
- Agent-host compromise can expose private plans and notification contacts, although the restricted agent credential cannot bypass v0.2 contract-controlled native settlement.
- A Full Access payroll-account key can bypass contract logic, redeploy code, or transfer account funds. The legacy root deployment key must be isolated from the scheduler; factory-created v0.2 children are created without access keys.
- An exceptional callback that cannot finalize locks settlement and administration until an owner-reviewed contract upgrade; this favors payment safety over availability.
- Malicious wallets, RPC providers, indexers, and browser extensions require operational controls beyond repository tests.
- Audit events omit recipient identity, so worker-specific history cannot be reconstructed from them.

## Reporting vulnerabilities

Do not publish secrets or weaponized exploit details in a public issue. Contact the repository owner privately with the affected revision, prerequisites, reproduction steps, impact, and suggested mitigation.
