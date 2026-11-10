import type { ReactNode } from "react";

export interface GuideVisual {
  label: string;
  title: string;
  caption: string;
  rows: Array<{ label: string; value: string; state?: "active" | "muted" | "warning" }>;
}

export interface GuideAction {
  label: string;
  to: string;
  external?: boolean;
}

export interface GuideSection {
  id: string;
  title: string;
  summary: string;
  content: ReactNode;
  visual: GuideVisual;
  action?: GuideAction;
}

export interface RoleGuide {
  role: string;
  title: string;
  intro: string;
  sections: GuideSection[];
}

const faucetUrl = "https://near-faucet.io";
const explorerUrl = "https://testnet.nearblocks.io";
const repositoryUrl = "https://github.com/arinze116/Clavis";

function BulletList({ children }: { children: ReactNode }) {
  return <ul className="grid gap-3 text-sm leading-6 text-ink/65 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-2.5 [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-moss">{children}</ul>;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-moss/15 bg-moss/[0.06] p-4 text-sm leading-6 text-ink/65">
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl bg-ink p-4 font-mono text-xs leading-6 text-white/75">
      <code>{children}</code>
    </pre>
  );
}

function MethodTable({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[680px] text-left text-xs leading-5">
        <thead className="border-b border-line bg-canvas/70 text-ink/45">
          <tr>
            <th className="px-4 py-3 font-semibold">Method</th>
            <th className="px-4 py-3 font-semibold">Parameters</th>
            <th className="px-4 py-3 font-semibold">Returns / purpose</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([method, parameters, result]) => (
            <tr key={method} className="align-top">
              <td className="px-4 py-3 font-mono font-semibold text-ink">{method}</td>
              <td className="px-4 py-3 font-mono text-ink/55">{parameters}</td>
              <td className="px-4 py-3 text-ink/60">{result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const businessGuide: RoleGuide = {
  role: "Business owner",
  title: "Launch and protect your payroll",
  intro:
    "Deploy an isolated Clavis contract, fund it with testnet NEAR, connect the restricted payroll agent, and monitor every policy decision from one browser dashboard.",
  sections: [
    {
      id: "connect-wallet",
      title: "Connect a NEAR testnet wallet",
      summary:
        "Your owner wallet signs setup and policy changes. Meteor, Sender, and MyNearWallet are the wallet adapters included in this release.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Install Meteor Wallet or Sender, or open MyNearWallet in a new tab.</li>
            <li>Open the wallet network settings and select <strong>Testnet</strong> before connecting.</li>
            <li>Create or import a testnet account, then use the wallet button in the Clavis header.</li>
          </BulletList>
          <Note>
            Testnet keeps the walkthrough safe: testnet NEAR has no monetary value, but wallet
            signatures and contract rules behave like the live network.
          </Note>
        </div>
      ),
      visual: {
        label: "Connection preview",
        title: "Choose a testnet wallet",
        caption: "The connection prompt shows the active network before you approve access.",
        rows: [
          { label: "Network", value: "NEAR testnet", state: "active" },
          { label: "Wallet", value: "Meteor / MyNearWallet / Sender" },
          { label: "Permission", value: "View account + request signatures", state: "muted" },
        ],
      },
      action: { label: "Connect in setup", to: "/setup" },
    },
    {
      id: "deploy-contract",
      title: "Deploy your payroll contract",
      summary:
        "The setup wizard creates a dedicated account under clavis.testnet, so each business owns an isolated rules engine and treasury.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Open Setup and choose a short business name; it becomes <code className="font-mono text-xs">name.clavis.testnet</code>.</li>
            <li>Describe your policy for the AI rule generator or enter daily and per-payment limits manually.</li>
            <li>Add each recipient's NEAR wallet, scheduled amount, personal cap, and schedule. Native NEAR is the only executable route in this release.</li>
            <li>Enter the payroll agent account, review the summary, and approve deployment in your wallet.</li>
          </BulletList>
          <Note>
            Setup checks that the deployed factory reports v0.2.0 or newer. Legacy factories are
            blocked because they would create authorization-only contracts. Keep approximately
            6–10 testnet NEAR available for deployment and initial native payouts.
          </Note>
        </div>
      ),
      visual: {
        label: "Setup · review",
        title: "Aster Labs payroll",
        caption: "The final review keeps the contract address, limits, roster, and agent visible before signing.",
        rows: [
          { label: "Contract", value: "aster-labs.clavis.testnet", state: "active" },
          { label: "Daily / payment", value: "600 / 150 NEAR" },
          { label: "Recipients", value: "4 configured" },
          { label: "Deployment", value: "Ready for wallet approval", state: "warning" },
        ],
      },
      action: { label: "Open setup", to: "/setup" },
    },
    {
      id: "fund-contract",
      title: "Fund the contract treasury",
      summary:
        "Payroll authorization and settlement need a funded contract. Send testnet NEAR directly to the contract address shown after deployment.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Copy the full contract address from the success screen or business dashboard.</li>
            <li>In your wallet, choose Send, select NEAR, and paste the contract address as the recipient.</li>
            <li>Start with 50+ testnet NEAR so the judge flow can run several payroll and security scenarios.</li>
            <li>Return to the dashboard and refresh until Treasury balance shows the transfer.</li>
          </BulletList>
          <a className="w-fit text-sm font-semibold text-moss underline decoration-moss/30 underline-offset-4" href={faucetUrl} target="_blank" rel="noreferrer">
            Get free testnet NEAR from the faucet
          </a>
        </div>
      ),
      visual: {
        label: "Wallet · send",
        title: "Fund payroll treasury",
        caption: "Always compare the complete contract address before confirming the transfer.",
        rows: [
          { label: "To", value: "aster-labs.clavis.testnet", state: "active" },
          { label: "Amount", value: "50 NEAR" },
          { label: "Network", value: "Testnet" },
          { label: "Estimated fee", value: "< 0.01 NEAR", state: "muted" },
        ],
      },
      action: { label: "View treasury", to: "/dashboard" },
    },
    {
      id: "configure-agent",
      title: "Configure the payroll agent",
      summary:
        "The agent checks schedules every 60 seconds and asks the contract to authorize due payments; it does not get authority to rewrite policy.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Set the agent account during setup or update it later from Policy controls.</li>
            <li>Use a Function Call Key restricted to the contract and the <code className="font-mono text-xs">request_payment</code> method.</li>
            <li>Verify the key on NearBlocks under Access keys: receiver and method names should match the payroll contract exactly.</li>
            <li>The scheduler also refuses contracts older than v0.2.0, then the contract rechecks pause state, recipient approval, caps, daily limit, schedule, route, and recipient commitment for every request.</li>
          </BulletList>
          <Note>
            A restricted key can request a decision, but it cannot add recipients, raise limits,
            change the owner, or withdraw the treasury.
          </Note>
        </div>
      ),
      visual: {
        label: "NearBlocks · access key",
        title: "Restricted agent permission",
        caption: "The receiver and method restriction are the proof that a compromised agent cannot call owner controls.",
        rows: [
          { label: "Receiver", value: "aster-labs.clavis.testnet", state: "active" },
          { label: "Allowed method", value: "request_payment" },
          { label: "Allowance", value: "Gas only" },
          { label: "Owner methods", value: "Not permitted", state: "muted" },
        ],
      },
      action: { label: "Inspect root contract", to: `${explorerUrl}/address/clavis.testnet`, external: true },
    },
    {
      id: "notifications",
      title: "Set up notifications",
      summary:
        "Link email and Telegram from the bell in the app header so payment, anomaly, policy, and delivery events reach you away from the dashboard.",
      content: (
        <BulletList>
          <li>Open the bell, enter your email, and verify the six-digit code Clavis sends.</li>
          <li>Select Connect Telegram, open the Clavis bot, and press Start to complete the secure pairing.</li>
          <li>While the linked session and notification service are available, confirmed approvals, rejections, anomalies, owner transactions, and settlement outcomes can generate alerts.</li>
          <li>You can disconnect either channel from the same browser panel at any time.</li>
        </BulletList>
      ),
      visual: {
        label: "Notification settings",
        title: "Two channels connected",
        caption: "Wallet signatures bind notification preferences to the connected account without storing contact details on-chain.",
        rows: [
          { label: "Email", value: "Verified", state: "active" },
          { label: "Telegram", value: "Connected", state: "active" },
          { label: "Anomaly alerts", value: "≈10-second poll" },
          { label: "Daily report", value: "Enabled", state: "muted" },
        ],
      },
      action: { label: "Open business console", to: "/dashboard" },
    },
    {
      id: "monitor-payroll",
      title: "Monitor payroll",
      summary:
        "The business console brings contract funding, authorization capacity, recipients, policy controls, anomalies, and privacy-minimized audit decisions into one operating view.",
      content: (
        <BulletList>
          <li>On v0.2 contracts, the displayed contract balance is also the native-NEAR payout treasury. Legacy deployments are labelled authorization-only.</li>
          <li>The payroll roster shows each worker’s route, personal cap, schedule, next authorization eligibility, and active state.</li>
          <li>Anomaly alerts surface off-hours, high-frequency, replay, route-change, and near-limit behavior.</li>
          <li>Generate the verified payroll report from a fresh NEAR final-state read; AI only prioritizes an evidence-backed recommendation.</li>
        </BulletList>
      ),
      visual: {
        label: "Business console",
        title: "Payroll under control",
        caption: "Sensitive amounts stay outside the public audit while owners retain the policy context they need.",
        rows: [
          { label: "Contract account", value: "84.2 NEAR", state: "active" },
          { label: "Daily capacity", value: "41% used" },
          { label: "Roster", value: "8 active · 1 suspended" },
          { label: "Open anomalies", value: "1 to review", state: "warning" },
        ],
      },
      action: { label: "Monitor payroll", to: "/dashboard" },
    },
    {
      id: "security-audit",
      title: "Run a security audit",
      summary:
        "The browser runs five fixed, versioned contract probes. The server independently matches every payment ID and rejection reason against the live audit ledger; AI may prioritize a next step but does not choose the tests or decide whether they passed.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Open Emergency controls and select Run contract security probes.</li>
            <li>Approve the wallet transaction that executes the fixed, no-funds audit method.</li>
            <li>Watch the verified result feed show the five fixed outcomes returned by the completed contract transaction.</li>
            <li>A successful result reads “5/5 attacks blocked”; open the public audit to inspect the matching rejected decisions.</li>
          </BulletList>
          <Note>
            The audit never sends a real payment. It records privacy-minimized rejection evidence so a
            judge can verify the policy boundary independently.
          </Note>
        </div>
      ),
      visual: {
        label: "Contract security probes",
        title: "5 / 5 attacks blocked",
        caption: "Each line maps to a rejected decision in the on-chain public audit.",
        rows: [
          { label: "Unapproved recipient", value: "Blocked", state: "active" },
          { label: "Over payment limit", value: "Blocked", state: "active" },
          { label: "Suspended recipient", value: "Blocked", state: "active" },
          { label: "Daily limit + off-hours", value: "Blocked", state: "active" },
        ],
      },
      action: { label: "Run audit", to: "/dashboard#security-audit" },
    },
  ],
};

export const workerGuide: RoleGuide = {
  role: "Worker",
  title: "Join payroll and inspect employer decisions",
  intro:
    "Create a NEAR testnet identity, share it securely with your employer, and view the employer-wide privacy-minimized decision history available from the contract.",
  sections: [
    {
      id: "get-wallet",
      title: "Get a NEAR testnet wallet",
      summary:
        "Your wallet is your payroll identity. Use a NEAR testnet account through one of the wallet adapters included in Clavis.",
      content: (
        <BulletList>
          <li>Install Meteor Wallet or Sender, or use MyNearWallet from its official website.</li>
          <li>Switch the wallet network to Testnet before creating the account.</li>
          <li>Choose a readable testnet account name and keep the recovery method private.</li>
          <li>Use only testnet funds in Clavis; they have no monetary value.</li>
        </BulletList>
      ),
      visual: {
        label: "Wallet onboarding",
        title: "Create your testnet identity",
        caption: "The account name is the address your employer will add to payroll.",
        rows: [
          { label: "Network", value: "Testnet", state: "active" },
          { label: "Account", value: "sarah.testnet" },
          { label: "Balance", value: "5 testnet NEAR", state: "muted" },
        ],
      },
      action: { label: "Get testnet funds", to: faucetUrl, external: true },
    },
    {
      id: "register",
      title: "Register for payroll",
      summary:
        "The worker portal prepares a shareable wallet card while keeping your route preferences local until your employer approves them on-chain.",
      content: (
        <BulletList>
          <li>Open the deployed app’s <strong>/worker</strong> route and connect your testnet wallet.</li>
          <li>Enter your display name. Native NEAR is the only executable destination in this release.</li>
          <li>Copy your NEAR wallet address or let your employer scan the QR code.</li>
          <li>Share the card through a trusted channel; Clavis hashes the address before the employer stores it in the contract.</li>
        </BulletList>
      ),
      visual: {
        label: "Worker portal",
        title: "Share with your employer",
        caption: "The QR card contains the connected NEAR testnet address, not salary information.",
        rows: [
          { label: "Display name", value: "Sarah Okafor" },
          { label: "Preferred route", value: "NEAR · NEAR", state: "active" },
          { label: "Wallet card", value: "Ready to copy" },
        ],
      },
      action: { label: "Open worker portal", to: "/worker" },
    },
    {
      id: "employer-adds-you",
      title: "Wait for your employer to add you",
      summary:
        "Your employer signs the roster update. Until that transaction confirms, Clavis cannot authorize a payment to your wallet commitment.",
      content: (
        <BulletList>
          <li>Your employer adds your wallet hash, personal cap, schedule, and approved route to their isolated contract.</li>
          <li>If notifications are linked, email or Telegram confirms when you are added.</li>
          <li>Reconnect at the worker portal; your schedule and next authorization date appear automatically.</li>
          <li>If no profile appears, confirm that both you and your employer used the exact same NEAR account address.</li>
        </BulletList>
      ),
      visual: {
        label: "Roster status",
        title: "Employer approval pending",
        caption: "The portal checks deployed Clavis contracts for the hash of your connected account.",
        rows: [
          { label: "Wallet hash", value: "Prepared locally" },
          { label: "On-chain roster", value: "Waiting", state: "warning" },
          { label: "Next step", value: "Employer signs add_recipient" },
        ],
      },
      action: { label: "Check registration", to: "/worker" },
    },
    {
      id: "receive-payment",
      title: "Receive your payment",
      summary:
        "The payroll agent checks due schedules automatically. The contract authorizes only requests that pass every owner-defined rule.",
      content: (
        <BulletList>
          <li>The agent checks payroll schedules approximately every 60 seconds.</li>
          <li>If you linked a notification channel and the service is online, you receive an approval or rejection alert.</li>
          <li>On v0.2 contracts, approved native NEAR moves directly from the contract and approval is recorded only after the transfer succeeds.</li>
          <li>Cross-chain requests fail closed in this release because custody is not contract-controlled end to end.</li>
          <li>If the route changes, your employer must approve the corresponding contract update first.</li>
        </BulletList>
      ),
      visual: {
        label: "Payment status",
        title: "Authorization approved",
        caption: "For v0.2 native payments, the finalized transaction includes both the contract transfer and the approval event.",
        rows: [
          { label: "Policy decision", value: "Approved", state: "active" },
          { label: "Route", value: "Native NEAR" },
          { label: "Notification", value: "Delivered" },
          { label: "Audit amount", value: "Omitted · transaction input remains public", state: "muted" },
        ],
      },
      action: { label: "View worker dashboard", to: "/worker" },
    },
    {
      id: "payment-history",
      title: "View employer decision history",
      summary:
        "Reconnect at /worker to see the employer contract’s approval and rejection history, timestamps, and explorer proofs. Entries do not identify recipients, so this is not worker-specific history.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Open the worker portal with the same wallet your employer registered.</li>
            <li>Use the decision-history filters to review employer-wide approved or rejected policy decisions.</li>
            <li>Select the explorer icon beside an entry to verify its block or transaction on NearBlocks.</li>
          </BulletList>
          <Note>
            Recipient identity and amounts are omitted from Clavis audit entries, so the worker
            portal cannot prove which entries belong to you. Normal NEAR transaction arguments
            and chain metadata remain public. Use employer records to reconcile actual payroll.
          </Note>
        </div>
      ),
      visual: {
        label: "Worker · history",
        title: "Privacy-minimized decision trail",
        caption: "Timestamps and outcomes are public; salary, wallet, and destination details are not stored in the audit entry.",
        rows: [
          { label: "Decision #0048", value: "Approved", state: "active" },
          { label: "Decision #0047", value: "Approved", state: "active" },
          { label: "Decision #0046", value: "Payment not due", state: "warning" },
        ],
      },
      action: { label: "View decision history", to: "/worker" },
    },
  ],
};

const ownerMethods: Array<[string, string, string]> = [
  ["add_recipient", "recipient_hash: String, config: RecipientConfigInput", "Adds one validated recipient (owner only)"],
  ["remove_recipient", "recipient_hash: String", "Removes a recipient and schedule state"],
  ["suspend_recipient / reinstate_recipient", "recipient_hash: String", "Changes active payment eligibility"],
  ["update_recipient_cap", "recipient_hash: String, personal_cap: U128", "Updates the recipient-specific maximum"],
  ["update_schedule", "recipient_hash: String, schedule: PaymentSchedule", "Sets Weekly, Biweekly, or Milestone"],
  ["update_recipient_route", "recipient_hash, preferred_chain, preferred_token, payment_split", "Validates route policy; only native NEAR executes in v0.2"],
  ["update_agent", "new_agent: AccountId", "Changes the only account allowed to request payments"],
  ["update_limits", "daily: Option<U128>, per_payment: Option<U128>", "Updates positive global limits without going below daily spend"],
  ["pause / unpause", "—", "Blocks or resumes all payment authorization"],
  ["emergency_withdraw", "—", "Pauses and returns balance above measured storage plus the operational reserve"],
  ["resolve_stale_native_payment", "delivered: bool, evidence_transaction_hash: String", "After a ten-minute finality window, resolves a callback that never completed and emits public recovery evidence"],
  ["dismiss_anomaly", "anomaly_id: u64", "Marks an owner-reviewed anomaly"],
  ["run_security_audit", "—", "Runs the five fixed no-funds rejection probes and returns structured results"],
];

const viewMethods: Array<[string, string, string]> = [
  ["get_owner / get_agent", "—", "AccountId"],
  ["contract_version", "—", "String"],
  ["get_recipient", "recipient_hash: String", "Option<RecipientView>"],
  ["get_recipients", "from: u64, limit: u64", "Vec<RecipientView> (limit capped at 100)"],
  ["get_recipient_count", "—", "u64"],
  ["is_registered", "account_id: AccountId", "bool"],
  ["get_daily_spent / get_daily_limit / get_per_payment_limit", "—", "U128"],
  ["get_treasury_balance", "—", "U128"],
  ["get_last_reset_timestamp", "—", "u64 nanosecond timestamp"],
  ["is_paused", "—", "bool"],
  ["get_pending_native_payment_recovery_at", "—", "Optional nanosecond timestamp for owner recovery"],
  ["get_audit_log / get_audit_log_reverse", "from: u64, limit: u64", "Vec<AuditEntry>"],
  ["get_log_count", "—", "u64"],
  ["get_anomalies", "from: u64, limit: u64, active_only: bool", "Vec<AnomalyEntry>"],
  ["get_anomaly_count", "—", "u64"],
];

export const developerGuide: RoleGuide = {
  role: "Developer",
  title: "Build on the Clavis architecture",
  intro:
    "Understand the Rust rules engine, TypeScript scheduler, React client, factory deployment model, and the NEAR primitives that constrain autonomous payroll.",
  sections: [
    {
      id: "architecture",
      title: "Architecture overview",
      summary:
        "Clavis separates scheduling, private planning, contract-controlled native settlement, and presentation so no off-chain settlement wallet can bypass policy.",
      content: (
        <BulletList>
          <li><strong>Smart contract (Rust):</strong> the final rules engine and native-NEAR settlement custodian for v0.2 deployments.</li>
          <li><strong>Payroll agent (TypeScript):</strong> the autonomous 60-second scheduler that discovers due work and submits <code className="font-mono text-xs">request_payment</code>.</li>
          <li><strong>Frontend (React + TypeScript):</strong> wallet connection, setup, owner controls, worker portal, AI assistance, and public verification.</li>
          <li><strong>Factory contract:</strong> deploys one isolated <code className="font-mono text-xs">*.clavis.testnet</code> payroll account per owner.</li>
        </BulletList>
      ),
      visual: {
        label: "System boundary",
        title: "Agent asks · contract decides",
        caption: "Payroll plans stay off-chain; public contract state and transaction inputs remain observable while audit entries minimize repeated sensitive fields.",
        rows: [
          { label: "React client", value: "Owner + worker actions" },
          { label: "Factory", value: "Isolated deployment" },
          { label: "Rust contract", value: "Policy authority", state: "active" },
          { label: "Agent", value: "Schedule + request only" },
        ],
      },
      action: { label: "Read source code", to: repositoryUrl, external: true },
    },
    {
      id: "run-locally",
      title: "Run Clavis locally",
      summary:
        "Verify the source and run the frontend with Node.js 20+ and Rust stable. Starting the scheduler additionally requires a verified v0.2 contract and a restricted contract-scoped key.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Clone the repository and install workspace dependencies.</li>
            <li>Run the typechecks, deterministic tests, contract builds, and production build before relying on a local change.</li>
            <li>The frontend verifies the live root, factory, and each payroll child independently, showing contract-controlled settlement only for deployments that report v0.2.0 or newer.</li>
            <li>Start the scheduler only after targeting a deployed v0.2 payroll contract, creating a <code className="font-mono text-xs">request_payment</code>-only key, and preparing permission-restricted credential and payroll files.</li>
          </BulletList>
          <CodeBlock>{`git clone https://github.com/arinze116/Clavis.git
cd Clavis
npm ci
rustup target add wasm32-unknown-unknown
npm run typecheck
npm run test:api
npm run test:agent
cargo test --manifest-path contract/Cargo.toml
bash scripts/build-contracts.sh
npm run build
npm run dev:frontend`}</CodeBlock>
          <Note>
            Never commit private keys, AI credentials, payroll plans, notification secrets, or
            generated agent state. The browser should call AI services through the serverless proxy.
            The current public root is v0.2.0 and the production scheduler uses a
            <code className="font-mono text-xs">request_payment</code>-only key. The factory is also
            v0.2.0 and has created a verified v0.2 child without access keys. Contract deployment,
            migration, and child creation sign testnet transactions; review account IDs and obtain
            explicit owner approval before running them.
          </Note>
        </div>
      ),
      visual: {
        label: "Local stack",
        title: "Source checks before runtime",
        caption: "The live root and factory report v0.2.0; the scheduler still rejects legacy payroll contracts.",
        rows: [
          { label: "Public root", value: "Live v0.2.0", state: "active" },
          { label: "Factory", value: "Live v0.2.0", state: "active" },
          { label: "Acceptance child", value: "v0.2.0 · no access keys", state: "active" },
          { label: "Agent target", value: "v0.2.0+ required" },
          { label: "Frontend", value: "Vite · localhost:5173" },
          { label: "Verification", value: "Tests + both WASM builds", state: "active" },
        ],
      },
      action: { label: "Open repository", to: repositoryUrl, external: true },
    },
    {
      id: "near-concepts",
      title: "Key NEAR concepts",
      summary:
        "The security story depends on protocol-level key restrictions, contract-controlled native settlement, and an explicit public-data boundary.",
      content: (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Function Call Keys", "Each contract uses a key restricted to that receiver and request_payment, so the scheduler cannot invoke owner controls."],
            ["Native settlement", "The v0.2 contract transfers NEAR itself and records approval only after the transfer callback succeeds."],
            ["Privacy boundary", "Audit entries omit amounts and destination details; standard NEAR call arguments and metadata remain public."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-line bg-white p-4">
              <h3 className="text-sm font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-ink/55">{text}</p>
            </div>
          ))}
        </div>
      ),
      visual: {
        label: "Authorization path",
        title: "Constrained before settlement",
        caption: "Native funds never pass through a separate settlement signer. Cross-chain execution is disabled in this release.",
        rows: [
          { label: "1 · Agent key", value: "request_payment only" },
          { label: "2 · Contract", value: "Rules enforced", state: "active" },
          { label: "3 · Contract transfer", value: "Native NEAR only" },
          { label: "4 · Callback", value: "Commit or rollback" },
        ],
      },
      action: { label: "Inspect public audit", to: "/audit" },
    },
    {
      id: "contract-reference",
      title: "Contract methods and rule order",
      summary:
        "Owner writes mutate policy, the agent submits payment requests, and view methods expose only the state needed by the browser and scheduler.",
      content: (
        <div className="grid gap-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Agent and owner change methods</h3>
            <MethodTable rows={[
              ["request_payment", "recipient_hash, amount, chain, token, recipient_account_id", "PromiseOrValue<PaymentResult>; agent only; native approval finalizes after transfer success"],
              ...ownerMethods,
            ]} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">View methods</h3>
            <MethodTable rows={viewMethods} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Factory and provisioning methods</h3>
            <MethodTable rows={[
              ["new (payroll)", "owner: AccountId, agent: AccountId, daily_limit: U128, per_payment_limit: U128", "Initializes a new payroll contract once"],
              ["new (factory)", "root_account: Option<AccountId>", "Initializes the deployment registry and root provisioner target"],
              ["create_payroll", "name, owner, agent, daily_limit, per_payment_limit + ≥6 NEAR", "Promise creating an isolated child contract"],
              ["get_all_contracts", "—", "Vec<ContractRecord>"],
              ["get_contract_by_owner", "owner: AccountId", "Option<ContractRecord>"],
              ["is_name_available", "name: String", "bool"],
              ["get_root_account", "—", "AccountId"],
              ["provision_payroll", "contract_id, owner, agent, limits, code + deposit", "Root-only factory provisioner Promise"],
            ]} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Private promise callbacks</h3>
            <MethodTable rows={[
              ["on_payroll_created", "name: String", "Factory-only callback that records a successful child deployment or starts a refund"],
              ["on_factory_refund_complete", "contract_id: AccountId", "Factory-only completion callback for a failed provision"],
              ["on_payroll_provisioned", "refund_to: AccountId, amount: U128", "Root-only callback that confirms initialization or refunds the factory"],
              ["on_provision_refund_complete", "—", "Root-only refund completion callback"],
              ["on_native_payment_settled", "—", "Private payroll callback that commits approval after transfer success or rolls policy state back"],
            ]} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Payment rule enforcement order</h3>
            <ol className="mt-3 grid gap-2 text-sm leading-6 text-ink/60 sm:grid-cols-2">
              {[
                "Expired daily spend window is reset",
                "Contract is not paused",
                "Caller is the configured agent",
                "Request is outside the 00:00–06:00 UTC blocked window",
                "Recipient is approved",
                "Recipient is active",
                "Amount is positive",
                "Per-payment limit is respected",
                "Recipient cap is respected",
                "Projected daily spend remains within the treasury limit",
                "Payment schedule is due",
                "Destination route is registered",
              ].map((rule, index) => (
                <li key={rule} className="flex gap-3 rounded-xl bg-canvas/70 p-3">
                  <span className="font-mono text-xs font-semibold text-moss">{String(index + 1).padStart(2, "0")}</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ),
      visual: {
        label: "Rules engine",
        title: "Stable order, deterministic result",
        caption: "The first failed rule becomes the privacy-minimized rejection reason. A passing native request reserves policy state; the callback keeps it on success or rolls it back on failure.",
        rows: [
          { label: "Caller", value: "Authorized agent", state: "active" },
          { label: "Recipient + caps", value: "Passed" },
          { label: "Schedule + route", value: "Passed" },
          { label: "Callback result", value: "Commit or rollback", state: "active" },
        ],
      },
      action: { label: "Verify on NearBlocks", to: `${explorerUrl}/address/clavis.testnet`, external: true },
    },
    {
      id: "contribute",
      title: "Contribute",
      summary:
        "Keep changes testnet-safe, preserve privacy boundaries, and include evidence for every contract or browser behavior you change.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Open the GitHub repository and check existing issues before starting overlapping work.</li>
            <li>Create a focused branch, add tests for contract or agent logic, and run the complete verification gate.</li>
            <li>For security issues, follow SECURITY.md and report privately rather than publishing an exploit.</li>
            <li>Feature requests should explain the user problem, NEAR primitive involved, privacy impact, and judge-visible demo path.</li>
          </BulletList>
          <CodeBlock>{`cargo test --manifest-path contract/Cargo.toml --workspace
npm run test:agent
npm run typecheck
npm run build`}</CodeBlock>
        </div>
      ),
      visual: {
        label: "Contribution checklist",
        title: "Evidence before merge",
        caption: "A useful pull request is narrow, tested, documented, and safe for existing contract state.",
        rows: [
          { label: "Focused issue", value: "Linked" },
          { label: "Tests", value: "Passing", state: "active" },
          { label: "Privacy review", value: "Complete" },
          { label: "Demo path", value: "Rehearsed", state: "active" },
        ],
      },
      action: { label: "Open GitHub", to: repositoryUrl, external: true },
    },
  ],
};
