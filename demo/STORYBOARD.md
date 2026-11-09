# Clavis demo storyboard

Target duration: 60–90 seconds, with the exact cut derived from ElevenLabs character timestamps.

| Beat | Visual | Narration focus | Product proof |
| --- | --- | --- | --- |
| 1. Promise | Landing hero and clearly labelled illustrative policy card | Automation without losing control | Privacy-minimized, rule-bound native payroll positioning |
| 2. Configure | Owner setup wizard: limits, recipients, agent | Define policy once | Treasury limits, personal caps, schedules, and the native NEAR route |
| 3. Constrain | Owner dashboard and rules engine | Restricted autonomous agent | Function Call Key limited to `request_payment` |
| 4. Enforce | Treasury, roster, anomaly alert, and policy controls | Independent onchain checks | Active recipient, schedule, caps, daily limit, route, and recipient commitment |
| 5. Fail closed | Native settlement transaction and audit decision | Contract transfer, callback commit, and rejection boundary | Approval only after transfer success; failed or unsupported routes do not advance policy |
| 6. Minimize evidence | Audit privacy statement, then worker portal | Employer-wide proof without repeated payroll details | Audit entries omit amounts and recipient identity; normal transaction data remains public |
| 7. Close | Landing architecture section and branded end card | Enough authority to work, none to break rules | Restricted agent → payroll contract → native NEAR transfer |

Production direction:

- 1920×1080, 30 fps, H.264/AAC MP4.
- OBS preserves the uninterrupted source walkthrough.
- Remotion adds scene wipes, restrained camera motion, product callouts, word-synchronized captions, title treatment, and end card.
- Captions and scene timing are generated from the same ElevenLabs alignment response as the narration audio.
- Record the v0.2 settlement sequence only after every deployment gate in `DEMO.md` is verified.
- The browser starts from a fresh profile. Wallet signing stays inside the wallet extension; no private key, seed phrase, service credential, or private payroll record appears in the capture.
- If the deployed root or factory is still legacy, replace the settlement sequence with source-and-test evidence and say explicitly that v0.2 is not live.
