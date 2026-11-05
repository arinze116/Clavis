# Clavis judge demo

## Demo thesis

Clavis lets a business delegate payroll execution without delegating treasury policy. The AI helps an owner express and understand policy, while a Rust contract makes every approval or rejection deterministic and publicly verifiable without putting recipient identities or amounts in the audit log.

Target length: **4 minutes**. Every user action in the walkthrough happens in the browser.

## Do not record or present until these gates pass

- `https://clavisapp.vercel.app/api/ai` returns a successful NEAR AI response from the production origin.
- `NEAR_AI_API_KEY` is configured server-side in Vercel. Never expose it as a bundled browser value.
- The current frontend and `/api/ai` deployment are live at `https://clavisapp.vercel.app`.
- The VPS agent is running the merged commit and its notification/private-plan API is healthy.
- The root and factory contract code hashes match the release WASM.
- A browser security audit on `clavis.testnet` returns five structured blocked results and adds five public audit entries.
- The final verification gate and both browser rehearsals pass.

If any gate is red, use the relevant fallback below and state the limitation plainly.

## Demo preparation

Use two browser profiles so there is no wallet-switching delay:

1. **Setup profile** — a funded, unregistered NEAR testnet owner wallet, already on `/setup`, advanced to Step 3 **Limits**.
2. **Owner profile** — `clavis.testnet`, already connected on `/dashboard` with contract data loaded.
3. Keep `/audit` open in a second tab in the owner profile.
4. Keep the NearBlocks pages for `clavis.testnet` and `factory.clavis.testnet` bookmarked.
5. Close wallet popups, clear old toasts, and use a 1280×720 or larger viewport at 100% zoom.

Paste this exact policy in the setup profile:

> Pay Sarah 1.5 NEAR weekly on Fridays. Cap each payment at 2 NEAR, cap total payroll at 10 NEAR per day, and never pay between midnight and 6am UTC.

Expected extraction:

- Daily limit: `10 NEAR`
- Per-payment limit: `2 NEAR`
- Schedule: `Weekly`
- Sarah cap: `2 NEAR`
- The values remain editable. Do not claim that a Friday anchor is enforced unless the returned warning and contract capability explicitly support it.

Current root demo data, recheck immediately before presenting:

| Proof point | Seeded value |
| --- | --- |
| Contract | `clavis.testnet` |
| Owner | `clavis.testnet` |
| Agent | `clavis-agent.testnet` |
| Treasury | Approximately `9.95 NEAR` at preparation time |
| Limits | `100 NEAR` daily, `20 NEAR` per payment |
| Roster | Worker One → NEAR/NEAR; Worker Two → Ethereum/USDC; Worker Three → BNB/BUSD |
| Existing decisions | Includes the five verified security-audit rejections from payment IDs 5–9 |
| Existing anomaly | OFF_HOURS at approximately `01:25 UTC` |

Values on testnet can change. Narrate the numbers visible on screen, not stale numbers from this document.

## Four-minute golden path

| Time | Exact browser action | Expected proof on screen | Narration |
| --- | --- | --- | --- |
| 0:00–0:18 | Show `/` and point to **Configure Clavis**, **Inspect public audit**, and **Read the guide**. | Product promise and three working entry points. | “Payroll agents are useful only if they cannot rewrite the rules. Clavis separates the AI assistant, the autonomous scheduler, and the on-chain authority.” |
| 0:18–0:55 | Switch to the setup profile on Step 3. Paste the prepared policy and click **Generate rules with AI**. | NEAR AI extraction summary plus editable daily, per-payment, schedule, and recipient-cap fields. | “The owner describes the policy in plain English. NEAR AI turns it into a draft, but nothing is silently deployed: the owner reviews and can edit every value before signing.” |
| 0:55–1:18 | Switch to the owner dashboard. Briefly point to treasury usage and the three-chain roster. | Contract balance, policy limits, and NEAR/Ethereum/BNB recipient routes loaded from testnet. | “This is the live owner console. Public contract state holds caps, schedules, routes, and pause state. Private scheduled amounts and destination addresses are signed from the browser into the agent’s private plan store.” |
| 1:18–1:50 | In **Anomaly alerts**, click **Analyze with AI** on the OFF_HOURS alert. Expand the result if needed. | A plain-English explanation citing the anomaly type/time and a concrete recommended action. | “The contract records the fact; NEAR AI makes it actionable. It explains what likely happened without claiming a compromise that the evidence cannot prove.” |
| 1:50–2:42 | Scroll to **Emergency controls** and click **Run AI security audit**. Approve the wallet transaction. Keep the live feed visible. | Five scenarios run in order: unapproved recipient, over-limit payment, suspended recipient, daily-limit breach, and off-hours payment. Final state: `5/5 attacks blocked`. | “AI explains the threat scenarios, but AI does not decide the result. The contract runs the same pure rules evaluator used for real payment requests, moves no funds, and writes each rejection to the public audit log.” |
| 2:42–3:10 | Click **Generate AI report**. After it loads, scroll through the modal and click **Copy report**. | CFO-style headings, decision totals, rejection reasons, anomalies, and policy recommendations. | “This is a control report, not a raw ledger dump. It summarizes the last thirty privacy-safe decisions and deliberately refuses to invent salary totals the audit does not expose.” |
| 3:10–3:38 | Open the `/audit` tab and refresh once if needed. Filter to **Rejected**. Point to the five newest security-audit entries and a NearBlocks link. | New entries appear without exposing recipient hashes or amounts; transaction proof is available. | “Here is the observable proof: the same transaction created five public-safe rejections. Anyone can verify the decisions, while the audit record omits payroll identities and amounts.” |
| 3:38–4:00 | Open `/guide` or resize briefly to 375px, then return to the closing line. | Role-specific business, worker, and developer guides; responsive navigation. | “Clavis is not a terminal demo. Owners configure policy and agents, workers verify their history, and developers can inspect every method and rule. The result is autonomous payroll with a contract-enforced blast radius.” |

## What the judges should remember

1. **Strongest pain:** a payroll bot normally combines automation and treasury authority, so one bad trigger or stolen key can become a treasury incident.
2. **Distinctive wedge:** AI assists with policy and explanation; a NEAR contract independently enforces the policy and produces privacy-safe public proof.
3. **Observable proof:** the five-scenario audit must return structured on-chain results and create five new audit entries. A successful transaction alone is not counted as a pass.

## Track and judging alignment

| Judge lens | Observable demo evidence |
| --- | --- |
| Agents | A 60-second scheduler consumes a browser-authorized private plan and can only receive approval by calling the contract rules engine. |
| Security | Pause/unpause, owner-only controls, caps, schedules, approved routes, off-hours blocking, and the on-chain five-scenario audit. |
| Privacy | Recipient identities and scheduled amounts stay out of the public audit shape; the UI explains the remaining standard-NEAR transaction-argument limitation honestly. |
| Real-world utility | Owner setup, recipient management, private delivery configuration, notifications, CFO reporting, worker history, and emergency controls are browser workflows. |
| NEAR integration | Rust contracts, isolated factory deployments, wallet-signed writes, NearBlocks evidence, Function Call Key support, and a NEAR Intents settlement adapter. |
| Product quality | Responsive UI, loading skeletons, transaction lifecycle toasts, accessible modals, guide pages, polling, SEO metadata, and a branded 404. |

## Failure fallbacks

| Failure | Honest fallback |
| --- | --- |
| NEAR AI request fails | Show the visible error state, then use a recording captured after a verified production AI call. Say: “This clip is the same production endpoint from our successful rehearsal.” Do not describe contract-defined fallback scenarios as an AI response. |
| Wallet popup stalls | Retry once. If it still fails, open the bookmarked NearBlocks audit transaction from the rehearsal and show its five audit entries. State that the transaction was pre-run on testnet. |
| RPC or NearBlocks is slow | Keep the already-loaded dashboard visible and use the bookmarked explorer transaction. Do not claim fresh state until the page confirms it. |
| Security audit transaction confirms but UI cannot verify 5/5 | Treat the audit as failed. Show the explorer receipt and existing entries, then explain that Clavis intentionally refuses to equate transaction success with a passed audit. |
| VPS private-plan bridge is unavailable | Do not add or edit a recipient live. Show the signed-plan UI and the previously verified server health evidence; say the off-chain plan write is unavailable, while contract controls remain live. |
| NEAR Intents relay is unavailable | State that the current hackathon deployment uses the Intents adapter in dry-run mode. Demonstrate route policy and intent construction, not completed cross-chain settlement. |
| Entire live site is unavailable | Play the final uninterrupted recording, then use NearBlocks and the repository for independent proof. Label the recording with its capture date and commit SHA. |

## Rehearsal log

Run the golden path twice after the final production deployment.

| Rehearsal | Result | Failure or delay | Fix |
| --- | --- | --- | --- |
| 1 | Pending |  |  |
| 2 | Pending |  |  |

Capture after the second clean run:

- Final commit SHA
- Production deployment URL and timestamp
- AI policy response screenshot
- AI anomaly response screenshot
- Security-audit transaction hash
- Screenshot showing `5/5 attacks blocked`
- Public audit screenshot with the five new entries
- 375px dashboard and guide screenshots
- Final demo video URL

Latest verified security-audit transaction: `Ng3cFYga534jZJJoFeAuzDgH5xLrMXP9Yrg52gkT4rc`.

## Closing line

> “Clavis gives an AI agent enough authority to run payroll—and no authority to change who gets paid, how much it may authorize, or whether the treasury can move at all.”
