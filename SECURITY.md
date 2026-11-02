# Security policy

Clavis is hackathon software running on NEAR testnet. It has not received an independent audit and must not custody mainnet funds.

## Security invariants

- Only the owner can mutate policy or withdraw contract funds.
- Only the configured agent can request payment authorization.
- The agent process accepts only a Function Call Key scoped to `request_payment` on the configured contract.
- Arithmetic affecting treasury policy is checked or saturating.
- Payment schedule and destination route are contract-enforced.
- Public audit and anomaly events contain no payment amount, recipient commitment, name, or route.
- Private payroll files, runtime state, reports, and credentials are ignored by Git.

## Threats covered

- Stolen or malfunctioning agent key
- Unapproved recipient request
- Per-payment, personal-cap, and daily-limit bypass attempts
- Early scheduled payment
- Destination redirection
- Rapid replay patterns
- Audit-storage exhaustion by unauthorized public callers
- Repeated execution of the same manual milestone
- Failed intent submission and process restart
- Accidental use of an over-privileged agent key

## Known testnet limitations

- Standard NEAR transaction arguments are public. Direct `request_payment` calls do not provide amount confidentiality.
- Unsalted hashes of predictable wallet addresses are commitments, not anonymity. Production onboarding must use a confidential registry or salted commitments.
- Owner-facing recipient metadata is stored in contract state for the hackathon UI and should move to encrypted storage for production.
- Cross-chain settlement is adapter-driven and must be integrated with the official confidential executor before a privacy claim is made.
- Emergency withdrawal keeps a fixed 1 NEAR storage reserve; production code should compute and test the exact storage requirement for upgraded state.

## Reporting a vulnerability

Do not open a public issue containing exploit details or credentials. Contact the repository owner privately with reproduction steps, affected commit, and expected impact.
