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
- Private files, runtime state, reports, and credentials are ignored by Git and permission-restricted where supported.

The current live root and factory are legacy v0.1 deployments until explicitly upgraded. The web app checks contract versions and does not apply v0.2 guarantees to legacy state.

## Evidence

Versioned threats, mapped tests, current source hashes, limitations, and reproduction commands are in [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) and [docs/generated/security-report.md](docs/generated/security-report.md).

## Known limitations

- No independent third-party audit.
- Testnet only.
- Cross-chain execution disabled.
- Unsalted account hashes are commitments, not anonymity.
- Configured recipient policy and standard NEAR transaction inputs are public.
- Host compromise can expose private plan data even though it cannot redirect v0.2 native settlement around the contract.
- A Full Access key on a payroll contract account is outside contract enforcement and can redeploy code or transfer account funds. The legacy root deployment key must be segregated from the agent host; factory-created v0.2 children are created without access keys.
- Callback uncertainty fails closed. There is no owner method that can guess a transfer result; an unfinalized callback locks further settlement until an owner-reviewed contract upgrade.

## Reporting a vulnerability

Do not publish credentials or weaponized exploit details in a public issue. Contact the repository owner privately with the affected revision, reproduction steps, prerequisites, impact, and suggested mitigation.
