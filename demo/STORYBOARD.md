# Clavis demo storyboard

Target duration: 60–90 seconds of content plus the opening and end-card holds. The current published render is 95.9 seconds and uses deterministic caption timing because no approved narration credential is configured.

| Beat | Visual | Narration focus | Product proof |
| --- | --- | --- | --- |
| 1. Promise | Production landing hero and illustrative policy card | Public app and product boundary | The web app is live; the card is explicitly illustrative |
| 2. Deploy truth | Production dashboard warning and loading-to-evidence transition | Deployed state before marketing copy | `clavis.testnet` is visibly labelled v0.1 authorization-only |
| 3. Constrain | Dashboard settlement boundary | Restricted source-v0.2 scheduler | Function Call key limited to `request_payment`; no external settlement signer |
| 4. Enforce | Security evidence page | Callback and fail-closed source behavior | 31 Rust, 66 agent, 30 API, and 5 browser checks |
| 5. Reconcile | Public audit loading and proof view | Durable private-plan reconciliation | Wallet cancellation or restart leaves the prior active plan unchanged |
| 6. Disclose | Audit privacy card, totals, and rejected decisions | Employer-wide minimized evidence | Normal chain data stays public; fallback links do not invent a transaction hash |
| 7. Close | Security evidence and branded end card | Verified source and explicit blocker | 132 tests passed; segregated root/factory signers gate live v0.2 deployment |

Production direction:

- 1920×1080, 30 fps, H.264 High/yuv420p MP4.
- Playwright preserves the uninterrupted public production walkthrough; OBS remains optional for a later owner-signed demo.
- Remotion adds scene wipes, restrained camera motion, product callouts, word-synchronized captions, title treatment, and end card.
- The current caption-led fallback uses deterministic word timing and intentionally contains no audio stream. A future narrated variant may use timestamped ElevenLabs alignment only when an approved credential is configured.
- Record the v0.2 settlement sequence only after every deployment gate in `DEMO.md` is verified.
- The browser starts from a fresh profile. Wallet signing stays inside the wallet extension; no private key, seed phrase, service credential, or private payroll record appears in the capture.
- If the deployed root or factory is still legacy, replace the settlement sequence with source-and-test evidence and say explicitly that v0.2 is not live.
