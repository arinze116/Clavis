# Clavis demonstration boundary

## Accepted tutorial

The current end-to-end tutorial is the local file `artifacts/video-production/clavis-desktop-tutorial-20261111/clavis-desktop-tutorial-178s.mp4`.

| Property | Verified value |
| --- | --- |
| Duration | 178.000000 seconds |
| Frames | 5,340 |
| Resolution and rate | 1920×1080, 30 fps |
| Video | H.264 High |
| Audio | AAC-LC stereo, 48 kHz |
| File size | 13,394,060 bytes |
| SHA-256 | `0b7b572ee064303e96c379caea44760ab1a84266ad3016f54e09f9024a71db24` |

The tutorial shows:

- the actual full desktop and application;
- Meteor connected as `clavis.testnet` on Testnet;
- existing-business initialization;
- two workers with one-time `Milestone` schedules;
- live AI policy extraction and explicit owner confirmation;
- genuine Meteor owner approval and private-plan signatures;
- payments 20 and 21 settling 0.001 NEAR each;
- Meteor connected as `arinze-worker1.testnet`;
- Worker 1 payment evidence and the matching finalized receipt;
- audit, factory, security, and privacy boundaries.

The film was captured against the v0.2 deployment. It is valid historical product evidence, but it does not demonstrate the v0.3 milestone-idempotency upgrade.

## Required claims

- AI proposes and explains; it does not sign or transfer funds.
- Native NEAR is paid by the payroll contract after policy checks.
- Both demonstrated workers remain on explicit one-time `Milestone` schedules.
- Cross-chain and split settlement are disabled.
- Audit minimization is not transaction confidentiality.
- Worker decision history is employer-wide because audit entries omit recipient identity.
- The demonstration runs on NEAR Testnet.

## Historical assets

The 180-second master at `artifacts/video-production/clavis-final-demo-20261111/clavis-final-demo-180s.mp4` is preserved unchanged as earlier evidence. The public release at <https://github.com/arinze116/Clavis/releases/tag/v0.2.0-source-verified> predates the later live settlement workflow.

## Future recording gate

A video may claim v0.3 only after all of these checks pass:

- the exact source commit is merged to `main`;
- root and factory report v0.3.0;
- deployed code hashes match locally built artifacts;
- root and factory state are preserved;
- the production agent runs the merged commit and passes `/health`;
- a v0.3 milestone reference is visible through the contract view;
- the public frontend serves the merged commit;
- no secret, private plan, or credential appears in footage.
