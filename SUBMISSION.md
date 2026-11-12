# Clavis submission status

## Current product truth

Clavis is a privacy-minimized payroll control plane on NEAR Testnet. Owners configure policy and privately authorize payroll plans. A restricted scheduler requests due native payments, while the payroll contract verifies policy and transfers its own NEAR.

Repository source is v0.3.0. The live root, factory, and backend agent remain v0.2.0 until the authorized v0.3 release is merged and deployed. Native settlement is live in v0.2; on-chain milestone-reference idempotency and restart reconciliation are new in v0.3.

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
- Cross-chain and split settlement fail closed.
- The worker audit list is employer-wide; it is not worker-specific payment history.
- Privacy minimization is not transaction confidentiality.
- The demonstrated workers remain on one-time `Milestone` schedules; recurring execution is not claimed for that state.
- Emergency withdrawal and recipient removal exist but were not executed for the accepted film because they are destructive operations.
- Repository tests are not an independent security audit.

## Verified live v0.2 evidence

| Item | Evidence |
| --- | --- |
| Root | `clavis.testnet`, v0.2.0, upgrade transaction [`7DAC…KqWA`](https://testnet.nearblocks.io/txns/7DACvFhKgtGrrGENKAoZk23uHjMmRtP6wXotRFHTKqWA) |
| Factory | `factory.clavis.testnet`, v0.2.0, upgrade transaction [`9RjG…Kdce`](https://testnet.nearblocks.io/txns/9RjGMTzWMCbPzndsSZQVw935UQRe8qGZYATCzEH9Kdce) |
| Factory child | `clavis-v02-e2e-20261110.clavis.testnet`, created in [`Dnch…q1qr`](https://testnet.nearblocks.io/txns/DnchBkKvWex7VWwmz5qE2aXDdDoYSzcq9BaoXC9kq1qr), no access keys |
| Worker 1 film settlement | Payment 20, [`B1Lt…3zDLD`](https://testnet.nearblocks.io/txns/B1Lthb1fvZahjQht9Bu168U8LeG4Cktp3B9ougy3zDLD), 0.001 NEAR |
| Worker 2 film settlement | Payment 21, [`GGou…VfTL`](https://testnet.nearblocks.io/txns/GGouc9FHTXpoKFVaiGFuBHGo7xK6ige5j7TgtJwfVfTL), 0.001 NEAR |
| Failed transfer rollback | Payment 11, [`8V6x…BedB`](https://testnet.nearblocks.io/txns/8V6x9ZtCnqyh8B43sn5ty5f4gdSwfV8GMA2JjZG7BedB) |

## Demonstration asset

The accepted end-to-end Testnet tutorial is stored locally at `artifacts/video-production/clavis-desktop-tutorial-20261111/clavis-desktop-tutorial-178s.mp4`.

| Property | Verified value |
| --- | --- |
| Duration | 178.000000 seconds |
| Frames | 5,340 at 30 fps |
| Video | H.264 High, 1920×1080 |
| Audio | AAC-LC stereo, 48 kHz |
| Size | 13,394,060 bytes |
| SHA-256 | `0b7b572ee064303e96c379caea44760ab1a84266ad3016f54e09f9024a71db24` |

The film shows the real v0.2 application workflow: owner wallet connection, business initialization, AI policy extraction, two workers, genuine Meteor approval, signed private plans, two final native settlements, and a connected Worker 1 receipt check. It is historical v0.2 deployment evidence and must not be presented as proof of the v0.3 upgrade.

## Public links

- Application: <https://clavisapp.vercel.app>
- Repository: <https://github.com/arinze116/Clavis>
- Root contract: <https://testnet.nearblocks.io/address/clavis.testnet>
- Factory: <https://testnet.nearblocks.io/address/factory.clavis.testnet>
- Historical source release: <https://github.com/arinze116/Clavis/releases/tag/v0.2.0-source-verified>

## Release condition

The production release is complete only when the v0.3 source is merged, CI passes, the exact merged commit is deployed, root and factory report v0.3.0, the agent is healthy on the same commit, the public frontend serves that commit, and the post-deployment verification report records the evidence.
