# Clavis threat model

## Scope and trust boundaries

Clavis is testnet hackathon software. The Rust payroll contract is the final authority for payment authorization; the scheduler decides when to propose a payment but cannot override contract policy. The owner wallet controls policy and treasury administration. Private payroll configuration and notification contacts remain in the agent service, while the NEAR contract and standard transaction metadata are public.

The security boundary covers:

- owner-only contract administration;
- agent-only payment authorization requests;
- recipient, amount, schedule, route, pause, and daily-spend enforcement;
- safe arithmetic and atomic audit writes;
- agent restart, replay, intent, and private-plan handling;
- notification authentication and event deduplication.

External solvers, destination chains, wallet software, RPC providers, and host infrastructure are dependencies, not trusted proof sources. Their behavior cannot be fully established by repository unit tests.

## Adversaries

1. An internet attacker with no owner or agent credentials.
2. A stolen or malfunctioning payroll agent credential.
3. A malicious recipient attempting to alter a route, cap, or schedule.
4. A replaying service or restarted agent attempting duplicate execution.
5. An operator who accidentally supplies malformed private configuration.
6. A curious chain observer correlating public function arguments and metadata.

## Enforced invariants

- Unauthorized callers cannot create payment audit entries.
- Every payroll receiver uses a contract-scoped Function Call key; Full Access and over-broad keys fail startup verification.
- The configured agent cannot pay an unknown or suspended recipient.
- Per-payment, recipient, and cumulative daily limits are independent checks.
- Owner pause, schedule, and exact destination route remain contract-enforced.
- Native delivery uses the configured payout destination, and settlement support is preflighted before on-chain authorization.
- Arithmetic overflow fails closed.
- The five-scenario browser probe cannot partially write results if audit capacity is exhausted.
- Private-plan APIs validate route inputs and do not echo the stored plan.
- Filled intents and processed notification events are not submitted or delivered twice.

## Reproducible evidence

Run the same suites used by CI:

```bash
cargo test --manifest-path contract/Cargo.toml
cargo test --manifest-path contract/Cargo.toml --package clavis-factory
npm exec --workspace=@clavis/agent -- vitest run --reporter=json --outputFile=../artifacts/security-evidence/vitest.json
node scripts/security/generate-security-report.mjs --status passed --vitest-report artifacts/security-evidence/vitest.json --frontend-output frontend/src/data/securityEvidence.generated.ts
```

The generator fails when a mapped test marker disappears, records the SHA-256 digest and exact line of every source file, and emits JSON and Markdown reports. The `Security evidence` GitHub Actions workflow runs the tests before generating its report and retains the result as a workflow artifact for 90 days.

The current matrix contains 23 source-linked threat cases across access control, policy enforcement, route and settlement integrity, replay resistance, private data handling, and arithmetic/state safety. The five browser-triggered scenarios are useful product demonstrations, but they are not presented as an AI-authored audit or as the primary security proof.

## Privacy boundary

Clavis minimizes the contents of its dedicated public audit entries: they omit salary amount, recipient commitment, wallet address, display name, and destination route. That does not make the underlying blockchain private. Standard NEAR transaction arguments, caller accounts, timing, gas use, and other chain metadata can remain observable. “Privacy-minimized payroll audit” is therefore the accurate claim for the current testnet system.

## Known limitations

- This repository has not received an independent third-party audit.
- The deployed system is testnet-only and must not custody mainnet funds.
- Cross-chain settlement depends on external solver and destination-chain behavior.
- Unsalted hashes of predictable wallet addresses are commitments, not strong anonymity.
- Owner-facing recipient metadata currently lives in contract state for the demo.
- Host compromise, malicious wallet extensions, and compromised RPC responses require operational controls beyond these unit tests.

## Reporting vulnerabilities

Do not publish secrets or exploit details in a public issue. Contact the repository owner privately with the affected commit, prerequisites, reproduction steps, impact, and any suggested mitigation.
