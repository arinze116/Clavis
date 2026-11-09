# Clavis demo and rehearsal plan

## Current published demo boundary

The current root contract reports v0.1.0 and the factory is legacy. The published video is therefore a caption-led source-and-test walkthrough of the production frontend. It explicitly says that v0.2 is source-verified rather than deployed.

- Public app: <https://clavisapp.vercel.app>
- Video: <https://github.com/arinze116/Clavis/releases/download/v0.2.0-source-verified/clavis-demo-1080p.mp4>
- Release evidence and screenshots: <https://github.com/arinze116/Clavis/releases/tag/v0.2.0-source-verified>

The source walkthrough uses public routes only. It does not seed wallet state, show secrets, imply a signed owner session, or manufacture settlement evidence.

Before recording or presenting a live v0.2 settlement story, all of these gates must pass:

- root contract upgraded through owner-authorized `migrate`;
- factory upgraded and reporting v0.2.0 or newer;
- frontend and agent deployed from the verified revision;
- dashboard shows contract-controlled settlement rather than the legacy warning;
- full repository gate passes;
- one successful settlement, one rollback, and one event-derived explorer link are verified.

Until then, a demo of the public site must say that the live contracts are legacy authorization-only and that v0.2 behavior is verified in source and tests, not deployed.

## Four-minute v0.2 walkthrough

Use this only after the deployment gates above pass.

| Time | Browser action | Accurate narration |
| --- | --- | --- |
| 0:00–0:30 | Open the landing page and dashboard. | “The agent can request payroll, but source v0.2 keeps native funds in the payroll contract. This dashboard reads the deployed contract version before making that claim.” |
| 0:30–1:10 | Show setup review and factory-version status. | “Setup refuses to create another legacy child. A v0.2 factory is required before the wallet can deploy.” |
| 1:10–1:50 | Add or edit a native recipient. | “The private change is staged first. It becomes active only after the signed contract state exactly matches, so wallet cancellation leaves the old plan intact.” |
| 1:50–2:30 | Show treasury and a native payment transaction. | “The contract checks policy, verifies the account commitment, transfers its own NEAR, and records approval only after the callback succeeds.” |
| 2:30–3:05 | Open public audit and an explorer link. | “The UI maps the emitted payment ID to this exact transaction. It no longer guesses by block order.” |
| 3:05–3:35 | Open the worker portal. | “This is employer decision history. Audit entries omit recipient identity, so Clavis does not pretend this list is specific to the connected worker.” |
| 3:35–4:00 | Open Security evidence and resize to mobile. | “Cross-chain execution is disabled, repository tests are source-linked, and the mobile menu remains open while dashboard data refreshes.” |

## Required limitation statements

- Testnet only.
- Cross-chain and split execution are disabled; there is no dry-run settlement mode.
- Audit minimization is not transaction confidentiality.
- Worker decision history is employer-wide.
- Explorer enrichment is best-effort and falls back without inventing a transaction link.
- Repository tests are not an independent third-party audit.

## Failure fallbacks

| Failure | Honest fallback |
| --- | --- |
| Root or factory still reports legacy | Stop the v0.2 live demo and show source/tests only. |
| Wallet popup is cancelled | Show that the staged private operation did not replace the active plan. |
| Reconciliation is delayed | Show the pending message; explain that the background loop retries while the prior plan remains active. |
| RPC or NearBlocks is unavailable | Use already verified final-block state and the fallback block/contract link; do not claim a fresh exact transaction mapping. |
| Cross-chain route is selected | Show the visible disabled/fail-closed state; do not describe intent construction or dry-run completion. |
| Security probe cannot be verified | Treat the probe as failed even if the transaction itself succeeded. |

## Rehearsal log

| Rehearsal | Revision and deployment | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `c28102f` production frontend at `clavisapp.vercel.app` | Passed | Six public routes; one `main`, one `h1`, zero overflow, zero application errors |
| 2 | `c28102f` production frontend at `clavisapp.vercel.app` | Passed | Same six-route sequence; zero application errors and zero observed NearBlocks rate limits |

## Published source-demo inspection

| Property | Verified result |
| --- | --- |
| Container and codec | MP4, H.264 High, yuv420p |
| Dimensions and rate | 1920×1080 at 30 fps |
| Duration and frames | 95.9 seconds; 2,877 decoded frames |
| Audio | No audio stream; captions carry the complete walkthrough because no approved narration key was configured |
| Black-frame scan | Zero segments detected |
| SHA-256 | `cb3dd6c6353752d8fd68b243bc5e699d3792269fe9ef61b908358e4c9464bab8` |
| Visual inspection | Opening, all seven scene beats, and end card inspected from a nine-frame contact sheet |

## Capture checklist

- [x] Frontend revision and production deployment verified
- [x] Root and factory `contract_version` responses recorded
- [x] Current legacy root and factory code hashes recorded
- [ ] Native settlement transaction with callback approval event
- [ ] Failed-transfer rollback evidence
- [x] Recipient cancellation/reconciliation source-and-test explanation
- [ ] Exact audit-link demonstration with same-block or five-entry case
- [x] Worker employer-history wording
- [x] Desktop, tablet, and mobile screenshots
- [x] Source-and-test demo URL and inspected render metadata

The remaining unchecked transaction items cannot be produced by the legacy contracts. They require the segregated root and factory Full Access signers, a reviewed v0.2 testnet upgrade, and then signed settlement evidence.
