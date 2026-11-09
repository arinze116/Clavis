# Clavis walkthrough recording guide

This guide prepares the next live-v0.2 Remotion demo. The currently published video predates deployment and remains historical evidence. Do not publish a replacement until every publication gate in [`DEMO.md`](../DEMO.md) has passed.

## 1. Verify the release before capture

Record from the deployed release only after you have evidence for all of the following:

- the root reports v0.2.0 and its deployed code hash matches the locally verified payroll WASM;
- the legacy factory status is shown explicitly and setup remains blocked;
- the frontend and agent revisions used in the recording are identified;
- one native payment shows the transfer and successful callback approval event;
- one failed-transfer test shows policy rollback;
- exact explorer-link enrichment has been verified on a real emitted `payment_id`;
- two uninterrupted browser rehearsals pass.

If root settlement evidence is missing, record a source-and-test walkthrough instead. If only the factory upgrade is missing, present root settlement as live but do not claim that new v0.2 child deployment works.

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

The generated source video, timing data, and final MP4 are ignored by Git. `npm run demo:record:obs` remains available for the approval-gated live-v0.2 walkthrough.

## 4. Prepare the browser sequence

Open these pages from the verified deployed origin:

1. Landing page at the public-proof boundary.
2. Public dashboard showing the live v0.2.0 root and contract-controlled treasury.
3. Setup showing the separate legacy factory boundary.
4. Security evidence showing the 34 contract, 9 signer, 66 agent, 44 API, and 6 browser checks.
5. Public audit showing minimized fields and rejection evidence.
6. Audit disclosure explaining employer-wide, non-confidential history.
7. Security evidence and a branded end card that names the factory-only signer blocker.

Do not manufacture wallet state through `localStorage`. Use the actual public read-only flow and owner-authorized testnet wallet when a signed action is part of the verified rehearsal.

## 5. Recording cue sheet

| Beat | Action | Required statement |
| --- | --- | --- |
| Promise | Hold the landing proof boundary. | “The public web app is live, while settlement guarantees remain versioned.” |
| Deploy truth | Show the dashboard and setup boundary. | “The root is live on v0.2.0; the separate legacy factory remains blocked for new children.” |
| Constrain | Show the settlement boundary. | “The live scheduler is limited to `request_payment`; native funds remain in the contract.” |
| Enforce | Show Security evidence. | “Callback success commits approval; failure rolls policy and schedule state back.” |
| Reconcile | Hold the audit/source evidence. | “Signed private-plan changes become active only after final-chain reconciliation.” |
| Disclose | Show audit privacy and rejection evidence. | “History is employer-wide, minimized rather than confidential, and explorer links never guess.” |
| Close | Return to Security evidence and the end card. | “159 checks verify this release; root settlement is live, while the exact factory signer still gates new child deployment.” |

## 6. Validate the finished render

```bash
npm run demo:typecheck
npm run demo:render
ffprobe -v error -show_streams -show_format demo/output/clavis-demo-1080p.mp4
ffmpeg -hide_banner -i demo/output/clavis-demo-1080p.mp4 \
  -vf 'blackdetect=d=0.25:pix_th=0.02' -an -f null -
```

Inspect frames at the opening, every scene transition, the audit disclosure, security evidence, and the end card. Confirm readable text, synchronized captions, no black frames, no secret material, and no claim stronger than the deployed evidence. For the caption-led fallback, verify that the file intentionally has no audio stream; narrated variants must additionally pass an audio review. Record final metadata and the video URL in `DEMO.md` and `SUBMISSION.md` only after inspection passes.
