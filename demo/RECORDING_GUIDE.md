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
- Recording: H.264 video, muted microphone and desktop audio
- Browser: clean profile, 100% zoom, no developer tools or unrelated extensions visible
- Cursor: visible during actions, parked away from evidence between actions
- Source duration: allow 5–10 seconds of still footage before the first action and after the final action

Save the source recording outside version control, then register it with:

```bash
npm run demo:register-recording -- "/absolute/path/to/clavis-walkthrough.mp4"
```

## 4. Prepare the browser sequence

Open these pages from the verified deployed origin:

1. Landing page at the public-proof boundary.
2. Setup page showing the factory version gate.
3. Owner dashboard showing the v0.2 settlement label, treasury, roster, and rules.
4. Native settlement transaction and callback evidence in NearBlocks.
5. Public audit with an event-derived transaction link.
6. Worker portal showing the employer-wide decision-history disclosure.
7. Security evidence and the mobile navigation state.

Do not manufacture wallet state through `localStorage`. Use the actual public read-only flow and owner-authorized testnet wallet when a signed action is part of the verified rehearsal.

## 5. Recording cue sheet

| Beat | Action | Required statement |
| --- | --- | --- |
| Promise | Hold the landing proof boundary. | “Source v0.2 controls native NEAR settlement; the UI reads the deployed version before making that claim.” |
| Configure | Show limits, a native recipient, and the restricted agent. | “Only native NEAR executes in this release. Cross-chain and split routes fail closed.” |
| Constrain | Show the restricted-key and policy controls. | “The agent can call `request_payment`; it cannot rewrite policy or move funds independently.” |
| Settle | Open the native payment and callback evidence. | “The contract transfers its own NEAR and records approval only after transfer success.” |
| Reconcile | Show a staged recipient change or its documented evidence. | “The private plan changes only after exact final-chain reconciliation.” |
| Verify | Open the audit transaction link. | “The emitted payment ID identifies this transaction; no block-order guess is used.” |
| Disclose | Show the worker history and privacy copy. | “The history is employer-wide, and audit minimization is not transaction confidentiality.” |
| Close | Show Security evidence and mobile navigation. | “Repository tests are source-linked evidence, not an independent audit.” |

## 6. Validate the finished render

```bash
npm run demo:typecheck
npm run demo:render
ffprobe -v error -show_streams -show_format demo/output/clavis-demo-1080p.mp4
```

Inspect frames at the opening, every scene transition, the settlement proof, the worker disclosure, and the end card. Confirm readable text, synchronized captions, clean audio, no black frames, no secret material, and no claim that is stronger than the deployed evidence. Record the final metadata and video URL in `DEMO.md` and `SUBMISSION.md` only after inspection passes.
