# Clavis hackathon brief

## Product

Clavis gives a business owner a rule-bound payroll contract and an AI-assisted operating interface on NEAR Testnet. The AI helps interpret policy and explain evidence; it cannot sign transactions or move funds. The owner controls policy, and the contract controls native settlement.

## Core flow

1. Connect an owner wallet on NEAR Testnet.
2. Initialize an existing payroll business or deploy an isolated factory child.
3. Configure workers, caps, routes, and schedules.
4. Use AI to extract a proposed policy from plain English.
5. Review and confirm the values.
6. Sign public policy changes and the private payroll plan.
7. Let the restricted scheduler request due native NEAR payments.
8. Verify final receipts from the owner dashboard, worker portal, and public audit.

## Security model

- The scheduler uses a per-contract Function Call key restricted to `request_payment`.
- The Rust contract checks policy and transfers its own NEAR.
- Approval is recorded only after transfer success; failure restores reserved state.
- v0.3 stores completed milestone references on-chain to prevent replay after agent state loss.
- Cross-chain and split settlement fail closed.
- Factory-created child accounts have no access keys.
- Root and factory deployment keys remain explicit privileged boundaries outside contract enforcement.

## Current status

Repository source, the public root, the public factory, and the backend agent are v0.3.0. Clavis is Testnet-only and privacy-minimized, not confidential or anonymous.

The accepted 178-second product tutorial was captured against v0.2. It demonstrates real owner setup, AI policy extraction, genuine Meteor approval, two 0.001 NEAR settlements, and Worker 1 receipt verification. SHA-256: `0b7b572ee064303e96c379caea44760ab1a84266ad3016f54e09f9024a71db24`.

Both demonstrated workers use explicit one-time `Milestone` schedules. The film does not claim recurring execution.

## Not implemented as live functionality

- Mainnet deployment.
- Confidential or anonymous transactions.
- Cross-chain or split settlement.
- Worker-initiated route changes without owner approval.
- Worker-specific reconstruction from minimized employer audit events.

## Builder

Arinze — Nigeria.
