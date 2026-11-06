# NEAR Hackathon 2026

Clavis is built for the `privacy`, `realworld`, `security`, `agents`, and `business` tracks.

## NEAR-native differentiators

- Function Call Keys restrict the payroll agent at the protocol layer.
- A Rust NEAR contract provides deterministic policy enforcement and privacy-minimized auditability.
- NEAR Intents provide the cross-chain settlement abstraction.
- The confidential executor boundary is isolated behind a replaceable adapter so hackathon runtime credentials do not enter contract or UI code.

## Highest-value demo moments

1. The agent autonomously submits a due payroll authorization.
2. The audit entry omits the amount and recipient while the UI clearly discloses that normal transaction arguments remain public.
3. The same restricted key attempts an unapproved recipient and is rejected.
4. The explorer shows that the key can call only `request_payment` on one contract.
5. The settlement record requires a filled solver intent for cross-chain proof; unsupported routes fail visibly instead of being replaced with direct NEAR.

## Sister project

Sister project: Velo — AI Solver Network for NEAR Intents
Repo: [coming soon — submitting under separate account]

## Builder

- Arinze
- X: [@useClavis_](https://x.com/useClavis_)
- Network: NEAR testnet only
