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
        "Your owner wallet signs setup and policy changes. Meteor, Sender, and MyNearWallet connect directly; HERE users can use the same testnet account through a supported browser wallet.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Install Meteor Wallet, HERE Wallet, Sender, or open MyNearWallet in a new tab.</li>
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
          { label: "Wallet", value: "Meteor / HERE / Sender" },
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
            <li>Add each recipient's NEAR wallet, scheduled amount, personal cap, schedule, and preferred route. Cross-chain routes also need the private destination address.</li>
            <li>Enter the payroll agent account, review the summary, and approve deployment in your wallet.</li>
          </BulletList>
          <Note>
            Keep approximately 6–10 testnet NEAR available for account creation, contract storage,
            and an initial operating balance. Testnet funds are free from the faucet.
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
            <li>The contract still rechecks pause state, recipient approval, caps, daily limit, schedule, and route for every request.</li>
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
          <li>Expect alerts for approvals, rejections, anomalies, recipient changes, pause events, withdrawals, and settlement outcomes.</li>
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
          { label: "Anomaly alerts", value: "Immediate" },
          { label: "Daily report", value: "Enabled", state: "muted" },
        ],
      },
      action: { label: "Open business console", to: "/dashboard" },
    },
    {
      id: "monitor-payroll",
      title: "Monitor payroll",
      summary:
        "The business console brings treasury health, recipients, policy controls, anomalies, and private-safe audit decisions into one operating view.",
      content: (
        <BulletList>
          <li>Treasury status compares the current balance with today’s authorized spend and daily limit.</li>
          <li>The payroll roster shows each worker’s route, personal cap, schedule, next payment, and active state.</li>
          <li>Anomaly alerts surface off-hours, high-frequency, replay, route-change, and near-limit behavior.</li>
          <li>Generate the AI payroll report for a CFO-style summary of approvals, rejections, anomaly trends, and policy recommendations.</li>
        </BulletList>
      ),
      visual: {
        label: "Business console",
        title: "Payroll under control",
        caption: "Sensitive amounts stay outside the public audit while owners retain the policy context they need.",
        rows: [
          { label: "Treasury", value: "84.2 NEAR", state: "active" },
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
        "The browser audit asks AI to explain five canonical attacks, then lets the contract prove that every scenario is blocked and publicly logged.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Open Emergency controls and select Run AI security audit.</li>
            <li>Approve the wallet transaction that executes the fixed, no-funds audit method.</li>
            <li>Watch the live feed test an unapproved recipient, over-limit payment, suspended recipient, daily-limit breach, and off-hours attempt.</li>
            <li>A successful result reads “5/5 attacks blocked”; open the public audit to inspect the matching rejected decisions.</li>
          </BulletList>
          <Note>
            The audit never sends a real payment. It records privacy-safe rejection evidence so a
            judge can verify the policy boundary independently.
          </Note>
        </div>
      ),
      visual: {
        label: "AI security audit",
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
  title: "Join payroll and follow every decision",
  intro:
    "Create a NEAR testnet identity, share it securely with your employer, choose a settlement route, and view your private-safe payment history.",
  sections: [
    {
      id: "get-wallet",
      title: "Get a NEAR testnet wallet",
      summary:
        "Your wallet is your payroll identity. Meteor and HERE Wallet both support testnet accounts suitable for the Clavis demo.",
      content: (
        <BulletList>
          <li>Install Meteor Wallet or HERE Wallet from its official website or app store listing.</li>
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
          <li>Open <strong>clavisapp.vercel.app/worker</strong> and connect your testnet wallet.</li>
          <li>Enter your display name and select your preferred destination chain and token.</li>
          <li>Copy your NEAR wallet address or let your employer scan the QR code.</li>
          <li>If you selected Ethereum or BNB Chain, also share the destination wallet address through the same trusted channel.</li>
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
          <li>Reconnect at the worker portal; your schedule and next payment date appear automatically.</li>
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
          <li>You receive a notification when the contract approves or rejects the request.</li>
          <li>For cross-chain routes, NEAR Intents finds the settlement path to your preferred chain and token.</li>
          <li>If the route changes, your employer must approve the corresponding contract update first.</li>
        </BulletList>
      ),
      visual: {
        label: "Payment status",
        title: "Authorization approved",
        caption: "The public record proves the decision while the private settlement layer handles destination details.",
        rows: [
          { label: "Policy decision", value: "Approved", state: "active" },
          { label: "Route", value: "NEAR Intents" },
          { label: "Notification", value: "Delivered" },
          { label: "Public salary amount", value: "Hidden", state: "muted" },
        ],
      },
      action: { label: "View worker dashboard", to: "/worker" },
    },
    {
      id: "payment-history",
      title: "View your payment history",
      summary:
        "Reconnect at /worker to see the contract’s approval and rejection history, timestamps, and explorer proofs.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Open the worker portal with the same wallet your employer registered.</li>
            <li>Use the payment history filters to review approved or rejected policy decisions.</li>
            <li>Select the explorer icon beside an entry to verify its block or transaction on NearBlocks.</li>
          </BulletList>
          <Note>
            Amounts are intentionally private. Only you and your employer should reconcile the
            actual payroll amount through your private records.
          </Note>
        </div>
      ),
      visual: {
        label: "Worker · history",
        title: "Private-safe decision trail",
        caption: "Timestamps and outcomes are public; salary, wallet, and destination details are not stored in the audit entry.",
        rows: [
          { label: "Decision #0048", value: "Approved", state: "active" },
          { label: "Decision #0047", value: "Approved", state: "active" },
          { label: "Decision #0046", value: "Payment not due", state: "warning" },
        ],
      },
      action: { label: "View payment history", to: "/worker" },
    },
  ],
};

const ownerMethods: Array<[string, string, string]> = [
  ["add_recipient", "recipient_hash: String, config: RecipientConfigInput", "Adds one validated recipient (owner only)"],
  ["remove_recipient", "recipient_hash: String", "Removes a recipient and schedule state"],
  ["suspend_recipient / reinstate_recipient", "recipient_hash: String", "Changes active payment eligibility"],
  ["update_recipient_cap", "recipient_hash: String, personal_cap: U128", "Updates the recipient-specific maximum"],
  ["update_schedule", "recipient_hash: String, schedule: PaymentSchedule", "Sets Weekly, Biweekly, or Milestone"],
  ["update_recipient_route", "recipient_hash, preferred_chain, preferred_token, payment_split", "Validates and updates allowed settlement routes"],
  ["update_agent", "new_agent: AccountId", "Changes the only account allowed to request payments"],
  ["update_limits", "daily: Option<U128>, per_payment: Option<U128>", "Updates positive global limits without going below daily spend"],
  ["pause / unpause", "—", "Blocks or resumes all payment authorization"],
  ["emergency_withdraw", "—", "Pauses and returns balance above the storage reserve"],
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
        "Clavis separates scheduling, authorization, settlement, and presentation so no single off-chain process becomes the source of truth.",
      content: (
        <BulletList>
          <li><strong>Smart contract (Rust):</strong> the final rules engine for ownership, caps, schedules, routes, pause state, audit, and anomalies.</li>
          <li><strong>Payroll agent (TypeScript):</strong> the autonomous 60-second scheduler that discovers due work and submits <code className="font-mono text-xs">request_payment</code>.</li>
          <li><strong>Frontend (React + TypeScript):</strong> wallet connection, setup, owner controls, worker portal, AI assistance, and public verification.</li>
          <li><strong>Factory contract:</strong> deploys one isolated <code className="font-mono text-xs">*.clavis.testnet</code> payroll account per owner.</li>
        </BulletList>
      ),
      visual: {
        label: "System boundary",
        title: "Agent asks · contract decides",
        caption: "Private plans stay off-chain; public contract state contains only the policy and privacy-safe decision evidence.",
        rows: [
          { label: "React client", value: "Owner + worker actions" },
          { label: "Factory", value: "Isolated deployment" },
          { label: "Rust contract", value: "Policy authority", state: "active" },
          { label: "Agent + Intents", value: "Schedule + settlement" },
        ],
      },
      action: { label: "Read source code", to: repositoryUrl, external: true },
    },
    {
      id: "run-locally",
      title: "Run Clavis locally",
      summary:
        "Use Node.js 20+, Rust stable with the wasm target, NEAR CLI RS, and a funded NEAR testnet account.",
      content: (
        <div className="grid gap-4">
          <BulletList>
            <li>Clone the repository and install workspace dependencies.</li>
            <li>Copy the example environment file and fill only testnet credentials.</li>
            <li>Build and deploy the contracts, start the scheduler, then start Vite.</li>
          </BulletList>
          <CodeBlock>{`git clone https://github.com/arinze116/Clavis.git
cd Clavis
npm ci
rustup target add wasm32-unknown-unknown
cp .env.example agent/.env
cp .env.example frontend/.env
npm run build:contract
bash scripts/deploy-factory.sh
npm run dev:agent
npm run dev:frontend`}</CodeBlock>
          <Note>
            Never commit private keys, AI credentials, payroll plans, notification secrets, or
            generated agent state. The browser should call AI services through the serverless proxy.
          </Note>
        </div>
      ),
      visual: {
        label: "Local stack",
        title: "Three processes, one testnet",
        caption: "The contract is remote on NEAR testnet; the frontend and scheduler can run locally against it.",
        rows: [
          { label: "Contract", value: "NEAR testnet", state: "active" },
          { label: "Agent", value: "Node.js 20+" },
          { label: "Frontend", value: "Vite · localhost:5173" },
          { label: "Verification", value: "npm test + build", state: "muted" },
        ],
      },
      action: { label: "Open repository", to: repositoryUrl, external: true },
    },
    {
      id: "near-concepts",
      title: "Key NEAR concepts",
      summary:
        "The security story depends on protocol-level key restrictions, intent-based settlement, and a clear confidential-execution boundary.",
      content: (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Function Call Keys", "A key can be restricted to one receiver and request_payment, so the scheduler cannot invoke owner controls."],
            ["NEAR Intents", "Approved work becomes a solver request that can settle to the worker’s registered destination chain and token."],
            ["Confidential execution", "Private amounts and destination details stay behind a replaceable executor adapter; standard NEAR call arguments are public."],
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
        caption: "A solver never decides payroll policy; it only handles a route after the contract approves the request.",
        rows: [
          { label: "1 · Agent key", value: "request_payment only" },
          { label: "2 · Contract", value: "Rules enforced", state: "active" },
          { label: "3 · Executor", value: "Private envelope" },
          { label: "4 · Intent", value: "Cross-chain settlement" },
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
              ["request_payment", "recipient_hash: String, amount: U128, chain: String, token: String", "PaymentResult; agent only, audited after caller validation"],
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
        caption: "The first failed rule becomes the public-safe rejection reason; an approval updates daily spend and the recipient schedule.",
        rows: [
          { label: "Caller", value: "Authorized agent", state: "active" },
          { label: "Recipient + caps", value: "Passed" },
          { label: "Schedule + route", value: "Passed" },
          { label: "Result", value: "Approval logged", state: "active" },
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
