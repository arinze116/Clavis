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
    id: "KEY-003",
    category: "Access control",
    threat: "A full-access settlement signer reuses the payroll agent account and weakens the restricted-key claim.",
    protection: "Startup rejects any settlement account that overlaps a payroll authorization account.",
    source: "agent/src/agent-credentials.test.ts",
    test: "rejects a settlement signer that reuses a payroll agent account",
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
    threat: "A native payment is sent to the worker identity wallet instead of the configured payout destination.",
    protection: "Native settlement uses the validated destination address from the payroll route.",
    source: "agent/src/intents.test.ts",
    test: "uses the configured native payout destination instead of the worker identity wallet",
  },
  {
    id: "SETTLE-002",
    category: "Settlement safety",
    threat: "The contract consumes policy capacity before a known-unavailable delivery route is checked.",
    protection: "Settlement preflight runs before request_payment and rejects missing signer or unsupported routes.",
    source: "agent/src/trigger.test.ts",
    test: "does not consume authorization when settlement preflight fails",
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
    threat: "A filled cross-chain intent is submitted a second time after restart or polling.",
    protection: "Filled intents are alerted and removed without resubmission.",
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
  "The deployed product is testnet-only and must not custody mainnet funds.",
  "Standard NEAR function-call arguments and chain metadata remain public even when public audit entries omit salary and recipient fields.",
  "Cross-chain settlement correctness depends on external solver and destination-chain behavior that unit tests cannot fully prove.",
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
  const agentFiles = walk(resolve(repositoryRoot, "agent", "src"), ".ts").filter((path) =>
    path.endsWith(".test.ts"),
  );
  const rust = rustFiles.reduce((total, path) => {
    const matches = readFileSync(path, "utf8").match(/#\[test\]/gu);
    return total + (matches?.length ?? 0);
  }, 0);
  const agentDefinitions = agentFiles.reduce((total, path) => {
    const matches = readFileSync(path, "utf8").match(/\b(?:it|test)(?:\.each)?\s*\(/gu);
    return total + (matches?.length ?? 0);
  }, 0);
  let agent = agentDefinitions;
  let count_basis = "source definitions";
  if (vitestReport) {
    const parsed = JSON.parse(readFileSync(vitestReport, "utf8"));
    if (typeof parsed.numTotalTests !== "number" || parsed.success !== true) {
      throw new Error("The Vitest report is missing a successful numTotalTests result");
    }
    agent = parsed.numTotalTests;
    count_basis = "Rust source definitions and successful Vitest JSON report";
  }
  return { rust, agent, total: rust + agent, count_basis };
}

function markdown(report) {
  const status = report.verification.status === "passed" ? "Passed" : "Source mapped";
  const snapshotLabel =
    report.verification.tree_state === "clean"
      ? `commit \`${report.verification.commit}\``
      : `the working tree based on commit \`${report.verification.commit}\``;
  const rows = report.cases
    .map(
      (item) =>
        `| ${item.id} | ${item.category} | ${item.threat} | ${item.protection} | [${item.test}](${item.source_url}) |`,
    )
    .join("\n");
  return `# Clavis security evidence\n\n` +
    `Generated from ${snapshotLabel} at ${report.verification.generated_at}.\n\n` +
    `**Verification:** ${status} | **Mapped threats:** ${report.summary.mapped_threats} | ` +
    `**Repository tests:** ${report.summary.repository_tests.total} ` +
    `(${report.summary.repository_tests.rust} Rust, ${report.summary.repository_tests.agent} agent)\n\n` +
    `${report.verification.run_url ? `[Open the CI run](${report.verification.run_url})\n\n` : ""}` +
    `| ID | Category | Threat | Deterministic protection | Reproducing test |\n` +
    `|---|---|---|---|---|\n${rows}\n\n` +
    `## Limitations\n\n${report.limitations.map((item) => `- ${item}`).join("\n")}\n`;
}

function typescript(report) {
  return `// Generated by scripts/security/generate-security-report.mjs. Do not edit manually.\n` +
    `export const securityEvidence = ${JSON.stringify(report, null, 2)} as const;\n`;
}

const options = parseArguments(process.argv.slice(2));
const commit = options.commit || process.env.GITHUB_SHA || gitValue(["rev-parse", "HEAD"], "unknown");
const treeState = gitValue(["status", "--porcelain"], "") ? "modified" : "clean";
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
    source_url: `${repositoryUrl}/blob/${commit}/${item.source}#L${line}`,
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
