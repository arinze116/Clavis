# Clavis complete feature inventory

Audit date: 2026-11-12
Application: React/TypeScript frontend, source v0.3 Rust contracts and scheduler, serverless AI/notification APIs, and a currently deployed v0.2 Testnet root/factory/agent.

Status labels: **Working** means supported by source and exercised by build/tests or live application evidence. **Conditional** means the feature requires the stated account, service or contract state. **Disabled by design** means the UI intentionally prevents an unsupported operation.

## Route inventory

| Route | Role | Purpose and major interactions | Required setup | Outputs / states | Status | Demo priority |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Public | Product proposition, policy boundary, autonomous-loop explanation, links to setup, guides, audit and security evidence | None | Marketing and architecture overview | Working | Essential; scene 1 |
| `/dashboard` | Public + owner | Reads final contract state; treasury and authorization capacity; recipients; schedules and routes; payment audit; anomalies; verified AI payroll report; rules updates; add/edit/suspend/remove recipients; agent and limit updates; pause/unpause; deterministic probes; recovery; emergency withdrawal | Contract ID; owner writes require matching wallet | Public read-only view, owner console, loading/error/empty states, transaction toasts | Working; writes conditional on owner wallet | Essential; scenes 5–7 |
| `/worker` | Worker | Connect wallet; discover hashed roster membership; register local preferences; share/copy wallet card; view active/suspended status, cap, schedule, route, next eligibility and employer-wide audit; request route-update UI | NEAR wallet and employer registration for full status | Registration, roster status, preferences, QR/share card, loading/error/unregistered states | Working; route request disabled by design until owner approval flow | Essential; scene 8 |
| `/audit` | Public | Poll final contract decisions; filter approved/rejected; paginate; open a decision in the Testnet explorer | Contract ID | Privacy-minimized decision list, refresh, loading/error/empty state | Working | Essential; scene 8 |
| `/security` | Public | Versioned threat matrix, deterministic test references, deployment boundaries and explicit non-claims | None | Source-linked security evidence and generated verification metadata | Working | Essential; scenes 5 and 9 |
| `/setup` | Owner | Seven-step wallet/business/limits/workers/agent/review/success wizard; existing-business initialization; factory compatibility check; AI policy extraction; isolated child deployment | Owner wallet; v0.3 contract for existing-business writes or v0.3 factory and Testnet funds for new deployment | Validated configuration, wallet approval, reconciled private plan, child record, success/error/retry states | Working in source; v0.3 writes blocked against the live v0.2 deployment | Essential; scenes 3–4 |
| `/guide` | Public | Chooses business, worker or developer learning path | None | Guide navigation | Working | Supporting; scene 3/9 montage |
| `/guide/business` | Owner/operator | Deployment, funding, configuration, scheduler, notifications, console and security-probe instructions | None | Step-by-step operational guide | Working | Supporting montage |
| `/guide/worker` | Worker | Wallet sharing, registration, status, preferences and audit instructions | None | Worker onboarding guide | Working | Supporting montage |
| `/guide/developer` | Developer/judge | Architecture, methods, data flow, deployment verification, threat model and source boundaries | None | Technical reference tables and verification guidance | Working | Supporting montage |
| `/privacy` | Public | Exact on-chain/off-chain data boundary and retention/observability explanation | None | Privacy policy and non-claims | Working | Essential; scene 9 |
| `/terms` | Public | Testnet-only terms and user responsibilities | None | Terms of use | Working | Supporting |
| `*` | Public | Branded 404 with route recovery | Invalid path | Not-found state and home link | Working | Supporting; not shown separately |

## Feature inventory

| Feature | Route / component | Role | Inputs | Output / important interaction | Status | Story class |
| --- | --- | --- | --- | --- | --- | --- |
| Wallet connect/disconnect and account copy | Global `WalletButton` | Owner/worker | Supported NEAR wallet selection | Connected account, copy affordance, notification settings, disconnect | Working; Meteor, Sender and MyNearWallet adapters documented | Essential |
| Public final-state dashboard | `/dashboard` | Anyone | Contract ID | Treasury, policy, roster, anomalies and decisions from a consistent final block | Working | Essential |
| Owner identity gate | `/dashboard` | Owner | Connected account | Owner controls unlock only when account matches contract owner | Working | Essential |
| Factory and root readiness checks | `/setup` | Owner | Factory/root IDs | Compatibility state; v0.3 setup fails closed for older deployments | Working | Essential |
| Business configuration | `/setup` | Owner | Business name, limits, agent | Reviewable deployment configuration | Working | Essential |
| AI policy extraction | `/setup` + `/api/ai` | Owner | Plain-English payroll policy | Grounded limits, schedule, recipient caps, warnings/ambiguities and model attribution | Working; live DeepSeek evidence captured | Essential |
| AI human-confirmation gate | `/setup` | Owner | Reviewed AI result | “Confirm and fill fields” updates editable values; no transaction or payment occurs | Working | Essential |
| Manual treasury limits | `/setup`, rules panel | Owner | Positive NEAR daily and per-payment limits | Validated owner transaction | Working | Essential |
| Recipient setup | `/setup`, rules panel | Owner | Name, NEAR wallet, region, cap, amount, schedule, route | Local hashing, private-plan staging and owner-approved public policy | Working | Essential |
| Route recommendation | `RecipientFormFields` + AI route endpoint | Owner | Selected recipient/route context | Recommendation limited to code-supported routes, confidence and model label | Working; native NEAR only executable | Important |
| Child contract deployment | `/setup` | Owner | Reviewed setup and 6 Testnet NEAR deployment balance | Factory-created isolated payroll contract and success route | Working, conditional on wallet approval/funds | Essential |
| Treasury/authorization status | Dashboard `TreasuryStatus` | Public/owner | Final contract snapshot | Balance, policy capacity and settlement boundary | Working | Essential |
| Recipient roster | `RecipientTable` | Owner/public | Contract recipients | Name, status, cap, route, schedule and eligibility | Working | Essential |
| Add recipient | Rules panel | Owner | Recipient form | Owner transaction plus private-plan reconciliation | Working | Essential |
| Edit recipient | Roster modal | Owner | Cap, route, schedule, active state, optional private-plan values | Exact owner-signed policy updates | Working; genuine `update_schedule` captured | Essential |
| Suspend/reinstate recipient | Roster quick action | Owner | Active toggle | Owner-signed status update | Working | Important |
| Remove recipient | Roster destructive confirmation | Owner | Selected recipient | Explicit irreversible removal transaction | Working; not executed for demo safety | Important |
| Restricted agent assignment | Rules panel/setup | Owner | Agent account ID | Owner-signed agent update; backend receives no policy-write authority | Working | Essential |
| Scheduled payroll agent | Backend scheduler | Operator | Off-chain plans and due times | Calls only `request_payment`, reconciles completed milestone references, settlement, and reports | Working in source; production v0.3 admission awaits deployment | Essential |
| Contract policy checks | v0.3 source / v0.2 live | System | Payment request | Pause, recipient, commitment, cap, schedule, daily limit, reserve and route checks | Working; real v0.2 payments passed | Essential |
| Native NEAR settlement | v0.3 source / v0.2 live | System | Approved request | Contract-controlled transfer and callback-backed approval/rollback | Working; payments 20 and 21 settled on v0.2 | Essential |
| Milestone replay protection | v0.3 contract and scheduler | System | Recipient hash and stable milestone reference | Successful reference stored on-chain; restart reconciliation prevents a second transfer | Implemented and regression-tested; not yet deployed | Essential security control |
| Cross-chain preferences | Worker/owner UI | Worker/owner | Non-NEAR route preference | Preference may be recorded, but execution fails closed | Disabled by design for settlement | Important |
| Payment audit | Dashboard and `/audit` | Public/owner/worker | Decision filter/page | Approved/rejected decisions and block reference without recipient/amount fields | Working | Essential |
| Explorer link | Payment audit | Public | Decision block | Opens external Testnet explorer | Working; explorer capture blocked by Cloudflare, RPC proof used in film | Supporting |
| AI payroll control report | Dashboard modal | Owner | Fresh final-state snapshot | Evidence-backed recommendation, model attribution, regenerate and copy | Working, conditional on AI API | Important |
| Anomaly detection | Agent + contract/UI | Owner | Payment cadence, time, route and limits | Off-hours, frequency, replay, route-change and near-limit alerts | Working | Important |
| AI anomaly analysis | `AnomalyAlerts` | Owner | Selected anomaly plus verified facts | Hypothesis/priority explanation; does not decide test results | Working, conditional on AI API and anomaly presence | Important |
| Mark anomaly reviewed | `AnomalyAlerts` | Owner | Anomaly ID | Owner-signed dismissal | Working | Important |
| Notification settings | Global modal + notification API | Owner | Email challenge/code or Telegram pairing | Verified email/Telegram links, reconnect/remove, event preferences; failed event delivery remains retryable | Working, service conditional | Important |
| Pause/unpause | Emergency controls | Owner | Confirmation | Blocks or re-enables all payment requests | Working | Important |
| Deterministic security probes | Emergency controls | Owner/public | Live contract | Five versioned contract probes with fixed pass/fail facts | Working | Essential |
| Pending settlement recovery | Dashboard | Owner | Reviewed Testnet transaction hash after recovery delay | Reconciles a stuck native settlement | Working, conditional on pending recovery state | Advanced |
| Emergency treasury withdrawal | Emergency controls | Owner | Acknowledgement plus typed `WITHDRAW` | Owner transaction pauses contract and returns withdrawable balance with reserve | Working; deliberately not executed | Advanced |
| Worker local preferences | `/worker` | Worker | Display name, payout amount and route details | Local/private plan data; public policy changes still require owner | Working | Essential |
| Wallet share card / QR | `/worker` | Worker | Connected account | Copyable wallet and share card for employer registration | Working | Important |
| Loading, retry and stale-refresh states | Main data routes/modals | All | Network and RPC outcomes | Skeletons, errors, retry buttons and background refresh copy | Working | Supporting |
| Empty states | Roster, anomalies, audit | All | No records | Guided next action without fake data | Working | Supporting |
| Transaction success/error feedback | Owner actions | Owner | Wallet/RPC result | Toasts include success, cancellation/failure detail and refresh | Working | Supporting |

## Internal or non-public capabilities

- Signer keyring setup, deployment shell scripts, acceptance scripts and RPC evidence collectors are operations tooling, not public product UI.
- Agent state stores, notification event de-duplication, report files and recovery bookkeeping are backend internals.
- Raw access keys, private payroll-plan files, AI credentials and notification secrets must never appear in the public demo.
- Attack simulation and contract unit fixtures support security evidence but are not portrayed as customer-facing controls.

## Audit conclusion

All essential user-facing areas were represented in the 178-second v0.2 full-desktop film. That film remains historical deployment evidence; it does not demonstrate the new v0.3 milestone-idempotency guarantee. The demonstrated transaction path is native NEAR Testnet only. Meteor connects as `arinze-worker1.testnet`; the worker route resolves that identity, shows decision 20 and opens the matching final Testnet receipt. The demonstrated schedule remains a one-time/manual `Milestone`.
