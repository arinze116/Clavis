# Clavis submission status

## Current product truth

Clavis is a privacy-minimised payroll control plane on NEAR Testnet. Owners configure policy and privately authorise payroll plans. A restricted scheduler requests due native payments, while the payroll contract verifies policy and transfers its own NEAR.

Repository source, the live root, the live factory, and the backend agent are v0.3.0. Native settlement, on-chain milestone-reference idempotency, restart reconciliation, and retryable notification delivery are deployed on NEAR Testnet.

## Implemented and verified

- Owner and worker Meteor wallet connections on NEAR Testnet.
- Existing-business setup and factory deployment setup.
- Worker commitment registration, compensation, cap, route, token, and schedule configuration.
- AI policy extraction with deterministic validation, editable values, and explicit human confirmation.
- Signed private-plan staging and exact final-chain reconciliation.
- Contract-controlled native NEAR settlement with callback commit or rollback.
- Public dashboard, employer-wide audit, worker registration/status view, anomalies, recovery controls, and source-linked security evidence.
- Email and Telegram notification linking.
- v0.3 on-chain milestone-reference replay protection.
- v0.3 notification retry semantics that do not mark an event complete before delivery succeeds.

## Disabled, limited, or not claimed

- Mainnet is not supported or deployed.
- Cross-chain execution is rejected by the contract, and the production scheduler rejects cross-chain and split plans before submission.
- The contract does not independently enforce split percentages during a direct native request; a configured agent key could bypass scheduler preflight and request the full amount through a native leg.
- The worker audit list is employer-wide; it is not worker-specific payment history.
- Privacy minimisation is not transaction confidentiality.
- The demonstrated workers remain on one-time `Milestone` schedules; recurring execution is not claimed for that state.
- Emergency withdrawal and recipient removal exist but were not executed for the accepted film because they are destructive operations.
- Repository tests are not an independent security audit.

## Verified live release evidence

| Item | Evidence |
| --- | --- |
| Root | `clavis.testnet`, v0.3.0, code hash `HCSBA…5yAr`, upgrade transaction [`Brhda…FfPY`](https://testnet.nearblocks.io/txns/BrhdaCBXiYCMEAwtBRPQoCr7bDbFc645sEMGa64zFfPY) |
| Factory | `factory.clavis.testnet`, v0.3.0, code hash `Jt4uf…iZy`, upgrade transaction [`C4TR…nEKP`](https://testnet.nearblocks.io/txns/C4TRcKwXwwQmBpfGrbXgMgGrDF2AKh2ZZ99JNpufnEKP) |
| Backend agent | v0.3.0, healthy on the VPS, with one Function Call key restricted to `request_payment` on `clavis.testnet` |
| Factory child | `clavis-v02-e2e-20261110.clavis.testnet`, created in [`Dnch…q1qr`](https://testnet.nearblocks.io/txns/DnchBkKvWex7VWwmz5qE2aXDdDoYSzcq9BaoXC9kq1qr), no access keys |
| Worker 1 film settlement | Payment 20, [`B1Lt…3zDLD`](https://testnet.nearblocks.io/txns/B1Lthb1fvZahjQht9Bu168U8LeG4Cktp3B9ougy3zDLD), 0.001 NEAR |
| Worker 2 film settlement | Payment 21, [`GGou…VfTL`](https://testnet.nearblocks.io/txns/GGouc9FHTXpoKFVaiGFuBHGo7xK6ige5j7TgtJwfVfTL), 0.001 NEAR |
| Failed transfer rollback | Payment 11, [`8V6x…BedB`](https://testnet.nearblocks.io/txns/8V6x9ZtCnqyh8B43sn5ty5f4gdSwfV8GMA2JjZG7BedB) |

## Demonstration asset

The definitive end-to-end Testnet tutorial is publicly available as a GitHub Release asset:

- [Direct 4K MP4](https://github.com/arinze116/Clavis/releases/download/v0.3.0-demo/clavis-final-4k-demo-177s.mp4)
- [Release page](https://github.com/arinze116/Clavis/releases/tag/v0.3.0-demo)

| Property | Verified value |
| --- | --- |
| Duration | 177.000000 seconds |
| Frames | 5,310 at constant 30 fps |
| Video | H.264 High, 3840×2160 |
| Audio | AAC-LC stereo, 48 kHz |
| Size | 525,364,542 bytes |
| SHA-256 | `bea52c9c1ead01b1cad9f242dc23dbb921ff48280c84cd34896d8b43c8ddddc4` |

The film shows the current v0.3 application and architecture alongside the complete owner, worker and AI workflow. The genuine Meteor approval, signed private plans, and final payments 20 and 21 are preserved historical Testnet evidence recorded before the v0.3 upgrade. They must not be described as fresh v0.3 settlement transactions. Both demonstrated schedules remain one-time `Milestone` plans.

## Public links

- Application: <https://clavisapp.vercel.app>
- Repository: <https://github.com/arinze116/Clavis>
- Root contract: <https://testnet.nearblocks.io/address/clavis.testnet>
- Factory: <https://testnet.nearblocks.io/address/factory.clavis.testnet>
- Historical source release: <https://github.com/arinze116/Clavis/releases/tag/v0.2.0-source-verified>
- Definitive 4K demo: <https://github.com/arinze116/Clavis/releases/tag/v0.3.0-demo>

## Release verification

The root and factory report v0.3.0, their deployment receipts are final, preserved state checks passed, and the v0.3 agent is healthy. The exact frontend and agent commit, CI, browser verification, and post-deployment checks are recorded in [the v0.3 production release report](docs/reports/clavis-v03-production-release-20261112.md).
