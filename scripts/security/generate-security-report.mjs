import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..", "..");

const cases = [
  {
    id: "AUTH-001",
    category: "Access control",
    threat: "An arbitrary account submits a payroll authorization request.",
    protection: "Only the configured agent account may call request_payment.",
    source: "contract/src/tests.rs",
    test: "rule_2_rejects_unauthorized_caller",
  },
  {
    id: "AUTH-002",
    category: "Access control",
    threat: "A non-owner invokes the privileged security probe and appends misleading evidence.",
    protection: "The security probe is owner-only and fails before changing audit state.",
    source: "contract/src/tests.rs",
    test: "non_owner_cannot_run_security_audit_or_append_entries",
  },
  {
    id: "AUTH-003",
    category: "Access control",
    threat: "A notification API caller impersonates a payroll owner.",
    protection: "Authorization is checked against the owner returned by the payroll contract.",
    source: "agent/src/notification-api.test.ts",
    test: "accepts only the owner returned by the payroll contract",
  },
  {
    id: "KEY-001",
    category: "Access control",
    threat: "A shared payroll agent starts with a Full Access key that can invoke owner methods.",
    protection: "Runtime access-key verification rejects Full Access and over-broad Function Call permissions.",
    source: "agent/src/near.test.ts",
    test: "rejects Full Access keys without an override",
  },
  {
    id: "KEY-002",
    category: "Access control",
    threat: "The scheduler reuses one contract credential for another payroll contract.",
    protection: "Credentials are resolved by receiver and missing contract entries fail closed.",
    source: "agent/src/agent-credentials.test.ts",
    test: "fails closed when a credential file omits a discovered contract",
  },
  {
    id: "VERSION-001",
    category: "Access control",
    threat: "The v0.2 scheduler submits to a legacy authorization-only payroll contract and advances policy without contract-controlled settlement.",
    protection: "Scheduler admission rejects every contract version older than v0.2.0 before a payment request can be sent.",
    source: "agent/src/near.test.ts",
    test: "rejects legacy authorization-only version",
  },
  {
    id: "POLICY-001",
    category: "Policy enforcement",
    threat: "The agent targets a recipient that the owner never approved.",
    protection: "Unknown recipient commitments are rejected on-chain.",
    source: "contract/src/tests.rs",
    test: "rule_3_rejects_unknown_recipient",
  },
  {
    id: "POLICY-002",
    category: "Policy enforcement",
    threat: "The agent pays a recipient after the owner suspends them.",
    protection: "Suspended recipients cannot receive an authorization.",
    source: "contract/src/tests.rs",
    test: "rule_4_rejects_suspended_recipient",
  },
  {
    id: "POLICY-003",
    category: "Policy enforcement",
    threat: "A single payment exceeds the global per-payment ceiling.",
    protection: "The contract rejects the request before spend state changes.",
    source: "contract/src/tests.rs",
    test: "rule_5_rejects_global_limit_breach",
  },
  {
    id: "POLICY-004",
    category: "Policy enforcement",
    threat: "A recipient-specific cap is bypassed while the global limit still permits payment.",
    protection: "The recipient cap is independently enforced.",
    source: "contract/src/tests.rs",
    test: "rule_6_rejects_personal_cap_breach",
  },
  {
    id: "POLICY-005",
    category: "Policy enforcement",
    threat: "Several individually valid requests exceed the daily treasury limit.",
    protection: "Cumulative daily spend is checked before approval.",
    source: "contract/src/tests.rs",
    test: "rule_8_rejects_daily_limit_breach",
  },
  {
    id: "POLICY-006",
    category: "Policy enforcement",
    threat: "A compromised agent continues payroll after the owner pauses the contract.",
    protection: "The pause switch is evaluated before payment policy.",
    source: "contract/src/tests.rs",
    test: "rule_1_rejects_when_paused",
  },
  {
    id: "ROUTE-001",
    category: "Route integrity",
    threat: "The agent redirects an approved recipient to another chain or token.",
    protection: "The destination route must exactly match owner-approved recipient policy.",
    source: "contract/src/tests.rs",
    test: "rejects_unregistered_destination_route",
  },
  {
    id: "SETTLE-001",
    category: "Settlement safety",
    threat: "A compromised agent redirects native NEAR to an account other than the approved recipient commitment.",
    protection: "The contract hashes the supplied NEAR account and rejects any destination that does not match the recipient commitment.",
    source: "contract/src/tests.rs",
    test: "rejects_native_destination_that_does_not_match_commitment",
  },
  {
    id: "SETTLE-002",
    category: "Settlement safety",
    threat: "A failed native transfer permanently consumes daily capacity or advances the recipient schedule.",
    protection: "The settlement callback rolls back reserved spend and schedule state before recording rejection.",
    source: "contract/src/tests.rs",
    test: "failed_native_transfer_rolls_back_reserved_policy_state",
  },
  {
    id: "SETTLE-003",
    category: "Settlement safety",
    threat: "A cross-chain request advances policy state even though custody is not contract-controlled.",
    protection: "Cross-chain authorization fails closed before daily spend or schedule state changes.",
    source: "contract/src/tests.rs",
    test: "cross_chain_authorization_fails_closed_before_policy_is_consumed",
  },
  {
    id: "SETTLE-004",
    category: "Settlement safety",
    threat: "A separate off-chain signer bypasses contract authorization and moves settlement funds directly.",
    protection: "The active delivery adapter refuses external settlement submission; native funds move only from the payroll contract.",
    source: "agent/src/intents.test.ts",
    test: "never submits funds from an external settlement signer",
  },
  {
    id: "SETTLE-005",
    category: "Settlement safety",
    threat: "A payout drains balance needed to persist the settlement callback and leaves an already delivered payment unresolved.",
    protection: "The contract preserves measured storage stake, callback write headroom, and an operational reserve before transferring funds.",
    source: "contract/src/tests.rs",
    test: "rejects_a_transfer_that_would_consume_storage_and_operational_reserves",
  },
  {
    id: "SETTLE-006",
    category: "Settlement safety",
    threat: "A transfer callback never completes and permanently locks payroll settlement.",
    protection: "After a ten-minute finality window, the owner can resolve the stale payment with a public transaction hash; failed-delivery recovery rolls back reserved state.",
    source: "contract/src/tests.rs",
    test: "stale_failed_callback_can_be_rolled_back_with_transaction_evidence",
  },
  {
    id: "SCHEDULE-001",
    category: "Schedule and replay",
    threat: "The agent requests a scheduled payment before it is due.",
    protection: "The contract rejects early scheduled requests.",
    source: "contract/src/tests.rs",
    test: "rejects_early_scheduled_payment",
  },
  {
    id: "SCHEDULE-002",
    category: "Schedule and replay",
    threat: "A manual milestone is executed repeatedly under the same milestone ID.",
    protection: "Stable milestone IDs trigger at most once.",
    source: "agent/src/trigger.test.ts",
    test: "triggers a milestone once per stable milestone ID",
  },
  {
    id: "REPLAY-001",
    category: "Schedule and replay",
    threat: "A legacy filled cross-chain intent persisted from v0.1 is submitted a second time after restart or polling.",
    protection: "Legacy filled intent records are alerted and removed without resubmission; new cross-chain submission is disabled.",
    source: "agent/src/trigger.test.ts",
    test: "alerts and removes a filled intent without submitting it again",
  },
  {
    id: "REPLAY-002",
    category: "Schedule and replay",
    threat: "The same finalized notification event is delivered repeatedly.",
    protection: "Processed events are deduplicated in persistent state.",
    source: "agent/src/notification-preferences.test.ts",
    test: "deduplicates processed transaction and authorization events",
  },
  {
    id: "DATA-001",
    category: "Private data handling",
    threat: "Malformed or attacker-controlled destination data is written to the private payroll plan.",
    protection: "Route inputs are validated before persistence.",
    source: "agent/src/payroll-plan-store.test.ts",
    test: "rejects malformed routes before writing a plan",
  },
  {
    id: "DATA-002",
    category: "Private data handling",
    threat: "A private-plan sync response leaks salary or destination details.",
    protection: "The plan is persisted but excluded from the API response.",
    source: "agent/src/payroll-plan-store.test.ts",
    test: "syncs a validated private plan without exposing it through the response",
  },
  {
    id: "DATA-003",
    category: "Private data handling",
    threat: "Wallet cancellation leaves a new private recipient active without the matching on-chain policy.",
    protection: "Private upserts remain staged across restart until exact public policy reconciliation commits them.",
    source: "agent/src/payroll-plan-store.test.ts",
    test: "keeps a staged upsert inactive across restart until reconciliation commits it",
  },
  {
    id: "DATA-004",
    category: "Private data handling",
    threat: "A private recipient is deleted before the owner confirms on-chain removal.",
    protection: "Staged removal leaves the active plan unchanged until the contract no longer contains the recipient.",
    source: "agent/src/payroll-plan-store.test.ts",
    test: "does not remove an active recipient until the staged removal is committed",
  },
  {
    id: "MATH-001",
    category: "Arithmetic and state safety",
    threat: "Daily-spend arithmetic wraps at the u128 boundary and permits excess payment.",
    protection: "Overflow is detected and rejected by the pure rule evaluator.",
    source: "contract/src/tests.rs",
    test: "pure_rule_evaluator_rejects_daily_spend_overflow",
  },
  {
    id: "STATE-001",
    category: "Arithmetic and state safety",
    threat: "The audit counter exhausts mid-probe and leaves partial or misleading evidence.",
    protection: "Capacity is checked before any of the five audit records are written.",
    source: "contract/src/tests.rs",
    test: "security_audit_fails_before_writing_when_log_counter_is_exhausted",
  },
];

const limitations = [
  "This report is generated from deterministic repository tests; it is not an independent third-party audit.",
  "The product is testnet-only and must not custody mainnet funds.",
  "Standard NEAR function-call arguments and chain metadata remain public even when public audit entries omit salary and recipient fields.",
  "Cross-chain execution is disabled in this release because contract-controlled custody is not implemented end to end.",
  "Source v0.2 implements contract-controlled native settlement; a deployment has that guarantee only when contract_version reports v0.2.0 or newer.",
  "A Full Access key on a payroll contract account is outside contract enforcement. The root deployment key is isolated from the agent process in a manually unlocked keychain, but VPS compromise remains a custody risk; factory-created v0.2 children are created without access keys.",
  "Callback uncertainty remains locked for ten minutes. Owner recovery then requires a public transaction hash and explicit delivery attestation; the contract cannot cryptographically verify that off-chain receipt interpretation.",
  "The five browser-triggered contract probes are a demonstration layer. The CI suites and source-linked cases below are the primary reproducible evidence.",
];

function parseArguments(values) {
  const options = {
    outputDirectory: resolve(repositoryRoot, "docs", "generated"),
    frontendOutput: null,
    status: "source-mapped",
    runUrl: "",
    commit: "",
    generatedAt: new Date().toISOString(),
    vitestReport: null,
    check: false,
  };

  for (let index = 0; index < values.length; index += 1) {
    const argument = values[index];
    const next = values[index + 1];
    if (argument === "--output-dir" && next) {
      options.outputDirectory = resolve(repositoryRoot, next);
      index += 1;
    } else if (argument === "--frontend-output" && next) {
      options.frontendOutput = resolve(repositoryRoot, next);
      index += 1;
    } else if (argument === "--status" && next) {
      options.status = next;
      index += 1;
    } else if (argument === "--run-url" && next) {
      options.runUrl = next;
      index += 1;
    } else if (argument === "--commit" && next) {
      options.commit = next;
      index += 1;
    } else if (argument === "--generated-at" && next) {
      options.generatedAt = next;
      index += 1;
    } else if (argument === "--vitest-report" && next) {
      options.vitestReport = resolve(repositoryRoot, next);
      index += 1;
    } else if (argument === "--check") {
      options.check = true;
    }
  }

  if (!["passed", "failed", "source-mapped"].includes(options.status)) {
    throw new Error("--status must be passed, failed, or source-mapped");
  }
  if (Number.isNaN(Date.parse(options.generatedAt))) {
    throw new Error("--generated-at must be an ISO-8601 timestamp");
  }
  return options;
}

function gitValue(args, fallback) {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fallback;
  }
}

function lineFor(source, marker) {
  const lines = source.split(/\r?\n/u);
  const index = lines.findIndex((line) => line.includes(marker));
  if (index === -1) {
    throw new Error(`Security evidence marker not found: ${marker}`);
  }
  return index + 1;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function walk(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path, extension);
    return extname(path) === extension ? [path] : [];
  });
}

function countTests(vitestReport) {
  const rustFiles = walk(resolve(repositoryRoot, "contract", "src"), ".rs");
  const signerFiles = walk(resolve(repositoryRoot, "tools", "clavis-near-signer", "src"), ".rs");
  const agentFiles = walk(resolve(repositoryRoot, "agent", "src"), ".ts").filter((path) =>
    path.endsWith(".test.ts"),
  );
  const apiFiles = walk(resolve(repositoryRoot, "tests", "api"), ".ts").filter((path) =>
    path.endsWith(".test.ts"),
  );
  const browserFiles = walk(resolve(repositoryRoot, "tests", "e2e"), ".ts").filter((path) =>
    path.endsWith(".spec.ts"),
  );
  const countTypeScriptTests = (paths) => paths.reduce((total, path) => {
    const matches = readFileSync(path, "utf8").match(/\b(?:it|test)(?:\.each)?\s*\(/gu);
    return total + (matches?.length ?? 0);
  }, 0);
  const rust = rustFiles.reduce((total, path) => {
    const matches = readFileSync(path, "utf8").match(/#\[test\]/gu);
    return total + (matches?.length ?? 0);
  }, 0);
  const signer = signerFiles.reduce((total, path) => {
    const matches = readFileSync(path, "utf8").match(/#\[test\]/gu);
    return total + (matches?.length ?? 0);
  }, 0);
  const agentDefinitions = countTypeScriptTests(agentFiles);
  const api = countTypeScriptTests(apiFiles);
  const browser = countTypeScriptTests(browserFiles);
  let agent = agentDefinitions;
  let count_basis = "source definitions";
  if (vitestReport) {
    const parsed = JSON.parse(readFileSync(vitestReport, "utf8"));
    if (typeof parsed.numTotalTests !== "number" || parsed.success !== true) {
      throw new Error("The Vitest report is missing a successful numTotalTests result");
    }
    agent = parsed.numTotalTests;
    count_basis =
      "Contract, signer, API, and browser source definitions plus successful Vitest JSON report";
  }
  return {
    rust,
    signer,
    agent,
    api,
    browser,
    total: rust + signer + agent + api + browser,
    count_basis,
  };
}

function markdown(report) {
  const status =
    report.verification.status === "passed"
      ? "Passed"
      : report.verification.status === "failed"
        ? "Failed"
        : "Source mapped";
  const snapshotLabel =
    report.verification.tree_state === "clean"
      ? `commit \`${report.verification.commit}\``
      : `the working tree based on commit \`${report.verification.commit}\``;
  const rows = report.cases
    .map(
      (item) =>
        `| ${item.id} | ${item.category} | ${item.threat} | ${item.protection} | ${
          item.source_url
            ? `[${item.test}](${item.source_url})`
            : `\`${item.source}:${item.line}\` — ${item.test}`
        } |`,
    )
    .join("\n");
  return `# Clavis security evidence\n\n` +
    `Generated from ${snapshotLabel} at ${report.verification.generated_at}.\n\n` +
    `**Verification:** ${status} | **Mapped threats:** ${report.summary.mapped_threats} | ` +
    `**Repository tests:** ${report.summary.repository_tests.total} ` +
    `(${report.summary.repository_tests.rust} contract Rust, ` +
    `${report.summary.repository_tests.signer} signer Rust, ` +
    `${report.summary.repository_tests.agent} agent, ` +
    `${report.summary.repository_tests.api} API, ${report.summary.repository_tests.browser} browser)\n\n` +
    `${report.verification.run_url ? `[Open the CI run](${report.verification.run_url})\n\n` : ""}` +
    `| ID | Category | Threat | Deterministic protection | Reproducing test |\n` +
    `|---|---|---|---|---|\n${rows}\n\n` +
    `## Limitations\n\n${report.limitations.map((item) => `- ${item}`).join("\n")}\n`;
}

function typescript(report) {
  return `// Generated by scripts/security/generate-security-report.mjs. Do not edit manually.\n` +
    `export const securityEvidence = ${JSON.stringify(report, null, 2)} as const;\n`;
}

function evidenceSnapshot(report) {
  return {
    schema_version: report.schema_version,
    project: report.project,
    summary: report.summary,
    cases: report.cases.map((item) => ({
      id: item.id,
      category: item.category,
      threat: item.threat,
      protection: item.protection,
      source: item.source,
      test: item.test,
      line: item.line,
      source_sha256: item.source_sha256,
    })),
    limitations: report.limitations,
  };
}

function readFrontendEvidence(filePath) {
  const source = readFileSync(filePath, "utf8");
  const prefix = "export const securityEvidence = ";
  const start = source.indexOf(prefix);
  const end = source.lastIndexOf(" as const;");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Unable to parse generated frontend evidence at ${filePath}`);
  }
  return JSON.parse(source.slice(start + prefix.length, end));
}

const options = parseArguments(process.argv.slice(2));
const commit = options.commit || process.env.GITHUB_SHA || gitValue(["rev-parse", "HEAD"], "unknown");
const evidenceSourcePaths = [...new Set(cases.map((item) => item.source))];
const verificationSourcePaths = [...new Set([
  ...evidenceSourcePaths,
  "scripts/security/generate-security-report.mjs",
  "scripts/verify.sh",
  ...walk(resolve(repositoryRoot, "contract", "src"), ".rs").map((path) =>
    relative(repositoryRoot, path),
  ),
  ...walk(resolve(repositoryRoot, "tools", "clavis-near-signer", "src"), ".rs").map((path) =>
    relative(repositoryRoot, path),
  ),
  ...walk(resolve(repositoryRoot, "agent", "src"), ".ts")
    .filter((path) => path.endsWith(".test.ts"))
    .map((path) => relative(repositoryRoot, path)),
  ...walk(resolve(repositoryRoot, "tests", "api"), ".ts")
    .filter((path) => path.endsWith(".test.ts"))
    .map((path) => relative(repositoryRoot, path)),
  ...walk(resolve(repositoryRoot, "tests", "e2e"), ".ts")
    .filter((path) => path.endsWith(".spec.ts"))
    .map((path) => relative(repositoryRoot, path)),
])];
const treeState = gitValue([
  "status",
  "--porcelain",
  "--untracked-files=no",
  "--",
  ...verificationSourcePaths,
], "")
  ? "modified"
  : "clean";
const mappedSourceState = gitValue([
  "status",
  "--porcelain",
  "--untracked-files=no",
  "--",
  ...evidenceSourcePaths,
], "")
  ? "modified"
  : "clean";
const repositoryUrl = "https://github.com/arinze116/Clavis";
const sources = new Map();
const evidenceCases = cases.map((item) => {
  const absolutePath = resolve(repositoryRoot, item.source);
  const source = sources.get(absolutePath) ?? readFileSync(absolutePath, "utf8");
  sources.set(absolutePath, source);
  const line = lineFor(source, item.test);
  return {
    ...item,
    line,
    source_sha256: hash(source),
    source_url:
      mappedSourceState === "clean"
        ? `${repositoryUrl}/blob/${commit}/${item.source}#L${line}`
        : "",
  };
});
const report = {
  schema_version: 1,
  project: "Clavis",
  summary: {
    mapped_threats: evidenceCases.length,
    categories: new Set(evidenceCases.map((item) => item.category)).size,
    repository_tests: countTests(options.vitestReport),
  },
  verification: {
    status: options.status,
    commit,
    tree_state: treeState,
    generated_at: options.generatedAt,
    run_url: options.runUrl || process.env.SECURITY_RUN_URL || "",
    workflow_url: `${repositoryUrl}/actions/workflows/security-evidence.yml`,
  },
  cases: evidenceCases,
  limitations,
};

if (options.check) {
  const expected = JSON.stringify(evidenceSnapshot(report));
  const committedReportPath = join(options.outputDirectory, "security-report.json");
  const committedReport = JSON.parse(readFileSync(committedReportPath, "utf8"));
  if (JSON.stringify(evidenceSnapshot(committedReport)) !== expected) {
    throw new Error(
      "Committed security evidence is stale; regenerate docs/generated and the frontend evidence module",
    );
  }
  if (options.frontendOutput) {
    const frontendReport = readFrontendEvidence(options.frontendOutput);
    if (JSON.stringify(evidenceSnapshot(frontendReport)) !== expected) {
      throw new Error(
        "Frontend security evidence is stale; regenerate it from the current source tree",
      );
    }
  }
  console.log(
    `Verified committed security evidence with ${report.summary.mapped_threats} mapped threats and ${report.summary.repository_tests.total} repository tests.`,
  );
  process.exit(0);
}

mkdirSync(options.outputDirectory, { recursive: true });
writeFileSync(join(options.outputDirectory, "security-report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(options.outputDirectory, "security-report.md"), markdown(report));
if (options.frontendOutput) {
  mkdirSync(dirname(options.frontendOutput), { recursive: true });
  writeFileSync(options.frontendOutput, typescript(report));
}

console.log(
  `Generated ${relative(repositoryRoot, options.outputDirectory)} with ${report.summary.mapped_threats} mapped threats and ${report.summary.repository_tests.total} repository tests.`,
);
