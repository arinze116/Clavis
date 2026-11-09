# Security policy

Clavis is unaudited NEAR testnet software and must not custody mainnet funds.

## Core invariants

- Only the owner may mutate policy, migrate, or withdraw.
- The scheduler key is a per-contract Function Call key restricted to `request_payment`.
- Source v0.2 native funds move from the payroll contract; there is no agent-held Full Access settlement signer.
- The contract validates recipient commitment, route, status, caps, daily spend, schedule, pause state, and operating hours.
- Approval is recorded only after native transfer success; failure rolls reserved state back.
- Cross-chain and split execution fail closed.
- Public audit events omit amount and recipient identity, while standard transaction inputs remain public.
- Private recipient changes stay staged until exact final-chain reconciliation.
- Secret-bearing private files, runtime state, and credentials are ignored by Git and permission-restricted. Published reports contain evidence only and exclude credentials.

The current live root reports v0.2.0 and has completed contract-controlled native settlements. The factory remains legacy; the web app checks each version independently and blocks new child deployment through that factory.

## Evidence

Versioned threats, mapped tests, current source hashes, limitations, and reproduction commands are in [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) and [docs/generated/security-report.md](docs/generated/security-report.md).

## Known limitations

- No independent third-party audit.
- Testnet only.
- Cross-chain execution disabled.
- Unsalted account hashes are commitments, not anonymity.
- Configured recipient policy and standard NEAR transaction inputs are public.
- Host compromise can expose private plan data even though it cannot redirect v0.2 native settlement around the contract.
- A Full Access key on a payroll contract account is outside contract enforcement and can redeploy code or transfer account funds. The root deployment key is isolated from the agent process in a manually unlocked keychain, but compromise of the VPS remains a custody risk. Factory-created v0.2 children are created without access keys.
- Callback uncertainty fails closed for ten minutes. After that window, the owner may resolve the pending payment only with a syntactically valid public Testnet transaction hash and an explicit delivered/failed attestation. A wrong attestation can still cause false accounting or a duplicate retry, so the final receipt must be reviewed first.

## Reporting a vulnerability

Do not publish credentials or weaponized exploit details in a public issue. Contact the repository owner privately with the affected revision, reproduction steps, prerequisites, impact, and suggested mitigation.
