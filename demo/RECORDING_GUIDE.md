# Clavis walkthrough recording guide

This guide records the source walkthrough used by the Remotion demo. Do not record or publish the v0.2 settlement story until every deployment gate in [`DEMO.md`](../DEMO.md) has passed.

## 1. Verify the release before capture

Record from the deployed release only after you have evidence for all of the following:

- the root and factory report v0.2.0 or newer;
- the deployed code hashes match the locally verified WASM files;
- the frontend and agent run the same verified revision;
- one native payment shows the transfer and successful callback approval event;
- one failed-transfer test shows policy rollback;
- exact explorer-link enrichment has been verified on a real emitted `payment_id`;
- two uninterrupted browser rehearsals pass.

If any item is missing, record a source-and-test walkthrough instead. State that the public contracts are still legacy and do not present v0.2 settlement as live.

## 2. Protect credentials and payroll data

- Use dedicated NEAR testnet accounts and non-sensitive demonstration recipients.
- Keep signing inside the wallet extension. Never paste or display a seed phrase, private key, API key, environment file, or terminal history containing credentials.
- Do not show private scheduled amounts, notification contacts, agent storage, or real worker destination addresses.
- Use the public dashboard and audit without a wallet wherever signing is unnecessary.
- Review every browser tab, notification, and wallet popup before recording.

## 3. Capture settings

- Canvas and output: 1920×1080
- Frame rate: 30 fps
- Public origin: `https://clavisapp.vercel.app`
- Browser: isolated Playwright context, no developer tools, extensions, wallet state, or notifications
- Source capture: Playwright WebM with the pointer parked away from evidence
- Final render: H.264 High, yuv420p MP4
- Caption-led fallback: no audio stream when no approved narration credential is configured

The reproducible source-and-test path is:

```bash
npm run demo:prepare:source
CLAVIS_DEMO_URL=https://clavisapp.vercel.app npm run demo:capture:source
npm run demo:typecheck
npm run demo:render
```

The generated source video, timing data, and final MP4 are ignored by Git. `npm run demo:record:obs` remains available for a future owner-signed live-v0.2 walkthrough after every deployment gate passes.

## 4. Prepare the browser sequence

Open these pages from the verified deployed origin:

1. Landing page at the public-proof boundary.
2. Public dashboard showing the live v0.1 authorization-only warning.
3. Dashboard settlement boundary showing source-v0.2 versus deployed-v0.1 behavior.
4. Security evidence showing the 31 Rust, 66 agent, 30 API, and 5 browser checks.
5. Public audit showing minimized fields and rejection evidence.
6. Audit disclosure explaining employer-wide, non-confidential history.
7. Security evidence and a branded end card that names the signer-gated upgrade.

Do not manufacture wallet state through `localStorage`. Use the actual public read-only flow and owner-authorized testnet wallet when a signed action is part of the verified rehearsal.

## 5. Recording cue sheet

| Beat | Action | Required statement |
| --- | --- | --- |
| Promise | Hold the landing proof boundary. | “The public web app is live, while settlement guarantees remain versioned.” |
| Deploy truth | Show the dashboard warning. | “The deployed v0.1 root authorizes requests but does not control settlement funds.” |
| Constrain | Show the settlement boundary. | “Source v0.2 limits the scheduler to `request_payment`; native funds remain in the contract.” |
| Enforce | Show Security evidence. | “Callback success commits approval; failure rolls policy and schedule state back.” |
| Reconcile | Hold the audit/source evidence. | “Signed private-plan changes become active only after final-chain reconciliation.” |
| Disclose | Show audit privacy and rejection evidence. | “History is employer-wide, minimized rather than confidential, and explorer links never guess.” |
| Close | Return to Security evidence and the end card. | “132 tests verify source v0.2; segregated root and factory signers still gate deployment.” |

## 6. Validate the finished render

```bash
npm run demo:typecheck
npm run demo:render
ffprobe -v error -show_streams -show_format demo/output/clavis-demo-1080p.mp4
ffmpeg -hide_banner -i demo/output/clavis-demo-1080p.mp4 \
  -vf 'blackdetect=d=0.25:pix_th=0.02' -an -f null -
```

Inspect frames at the opening, every scene transition, the audit disclosure, security evidence, and the end card. Confirm readable text, synchronized captions, no black frames, no secret material, and no claim stronger than the deployed evidence. For the caption-led fallback, verify that the file intentionally has no audio stream; narrated variants must additionally pass an audio review. Record final metadata and the video URL in `DEMO.md` and `SUBMISSION.md` only after inspection passes.
