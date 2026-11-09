export interface PaymentResult {
  approved: boolean;
  payment_id: number;
  reason?: string | null;
  settled: boolean;
  transaction_hash?: string;
}

export interface FailedTransferDecision {
  block_height: number;
  outcome: { Rejected: string };
  payment_id: number;
  timestamp: number | string;
}

export interface RecoveredFailedTransferEvidence {
  captured_at: string;
  network: string;
  rpc_url: string;
  transaction_hash: string;
  sender: string;
  final_execution_status: string;
  status: { SuccessValue: string };
  decision: FailedTransferDecision;
  current: {
    log_count: number;
    daily_spent: string;
    pending_recovery_at: string | null;
    probe_recipient: unknown | null;
  };
}

export interface FinalTransactionOutcome {
  final_execution_status?: string;
  status?: { Failure?: unknown; SuccessValue?: string };
  transaction?: {
    hash?: string;
    signer_id?: string;
    receiver_id?: string;
    actions?: Array<{
      FunctionCall?: {
        args?: string;
        deposit?: string;
        method_name?: string;
      };
    }>;
  };
  receipts_outcome?: Array<{
    outcome?: {
      executor_id?: string;
      logs?: string[];
    };
  }>;
}

interface FailedTransferExpectations {
  agentAccountId: string;
  amountYocto: string;
  contractId: string;
  failureAccountId: string;
  failureHash: string;
  reason: string;
}

interface UnauthorizedExpectations {
  amountYocto: string;
  contractId: string;
  recipientHash: string;
  reason: string;
  workerAccountId: string;
}

interface WaitForFinalStateOptions<T> {
  describe: string;
  intervalMs?: number;
  isExpected: (state: T) => boolean;
  load: () => Promise<T>;
  maxAttempts?: number;
  pause?: (milliseconds: number) => Promise<void>;
}

const DEFAULT_FINAL_STATE_ATTEMPTS = 30;
const DEFAULT_FINAL_STATE_INTERVAL_MS = 1_000;
const TRANSACTION_HASH_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/u;

export async function waitForFinalState<T>(
  options: WaitForFinalStateOptions<T>,
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_FINAL_STATE_ATTEMPTS;
  const intervalMs = options.intervalMs ?? DEFAULT_FINAL_STATE_INTERVAL_MS;
  const pause = options.pause ?? wait;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Final-state polling requires at least one attempt");
  }
  if (!Number.isFinite(intervalMs) || intervalMs < 0) {
    throw new Error("Final-state polling requires a non-negative interval");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const state = await options.load();
      if (options.isExpected(state)) return state;
      lastError = undefined;
    } catch (reason) {
      lastError = reason;
    }
    if (attempt < maxAttempts) await pause(intervalMs);
  }

  const suffix = lastError ? ` Last RPC error: ${errorMessage(lastError)}` : "";
  throw new Error(
    `${options.describe} was not visible after ${maxAttempts} final-state attempts.${suffix}`,
  );
}

export function parseRecoveredFailedTransferEvidence(
  value: unknown,
): RecoveredFailedTransferEvidence {
  const root = requireRecord(value, "recovered failed-transfer evidence");
  const status = requireRecord(root.status, "recovered transaction status");
  const decision = requireRecord(root.decision, "recovered payment decision");
  const outcome = requireRecord(decision.outcome, "recovered payment outcome");
  const current = requireRecord(root.current, "recovered current state");

  const parsed: RecoveredFailedTransferEvidence = {
    captured_at: requireString(root.captured_at, "captured_at"),
    network: requireString(root.network, "network"),
    rpc_url: requireString(root.rpc_url, "rpc_url"),
    transaction_hash: requireString(root.transaction_hash, "transaction_hash"),
    sender: requireString(root.sender, "sender"),
    final_execution_status: requireString(
      root.final_execution_status,
      "final_execution_status",
    ),
    status: {
      SuccessValue: requireString(status.SuccessValue, "status.SuccessValue"),
    },
    decision: {
      block_height: requirePositiveSafeInteger(decision.block_height, "decision.block_height"),
      outcome: {
        Rejected: requireString(outcome.Rejected, "decision.outcome.Rejected"),
      },
      payment_id: requirePositiveSafeInteger(decision.payment_id, "decision.payment_id"),
      timestamp: requireTimestamp(decision.timestamp),
    },
    current: {
      log_count: requirePositiveSafeInteger(current.log_count, "current.log_count"),
      daily_spent: requireDigits(current.daily_spent, "current.daily_spent"),
      pending_recovery_at: requireNullableString(
        current.pending_recovery_at,
        "current.pending_recovery_at",
      ),
      probe_recipient: current.probe_recipient ?? null,
    },
  };
  if (!Number.isFinite(Date.parse(parsed.captured_at))) {
    throw new Error("Recovered failed-transfer evidence has an invalid captured_at timestamp");
  }
  if (!TRANSACTION_HASH_PATTERN.test(parsed.transaction_hash)) {
    throw new Error("Recovered failed-transfer evidence has an invalid transaction hash");
  }
  return parsed;
}

export function verifyRecoveredFailedTransfer(
  evidence: RecoveredFailedTransferEvidence,
  transaction: FinalTransactionOutcome,
  expected: FailedTransferExpectations,
): { decision: FailedTransferDecision; result: PaymentResult; transactionHash: string } {
  if (evidence.network !== "testnet") {
    throw new Error(`Recovered failed-transfer evidence is for ${evidence.network}, not testnet`);
  }
  if (evidence.sender !== expected.agentAccountId) {
    throw new Error("Recovered failed-transfer evidence has an unexpected sender");
  }
  if (evidence.final_execution_status !== "FINAL") {
    throw new Error("Recovered failed-transfer evidence is not final");
  }
  if (evidence.decision.outcome.Rejected !== expected.reason) {
    throw new Error("Recovered failed-transfer evidence has an unexpected rejection reason");
  }
  if (evidence.current.log_count !== evidence.decision.payment_id) {
    throw new Error("Recovered failed-transfer evidence did not capture the decision as the latest audit");
  }
  if (evidence.current.pending_recovery_at !== null || evidence.current.probe_recipient !== null) {
    throw new Error("Recovered failed-transfer evidence did not capture a clean rollback state");
  }

  if (transaction.final_execution_status !== "FINAL" || transaction.status?.Failure) {
    throw new Error("Recovered failed-transfer transaction is not successful and final");
  }
  if (transaction.transaction?.hash !== evidence.transaction_hash) {
    throw new Error("Recovered failed-transfer transaction hash does not match its evidence");
  }
  if (
    transaction.transaction.signer_id !== expected.agentAccountId ||
    transaction.transaction.receiver_id !== expected.contractId
  ) {
    throw new Error("Recovered failed-transfer transaction has an unexpected signer or receiver");
  }

  const calls = (transaction.transaction.actions ?? []).flatMap((action) =>
    action.FunctionCall ? [action.FunctionCall] : [],
  );
  if (calls.length !== 1 || calls[0]?.method_name !== "request_payment") {
    throw new Error("Recovered failed-transfer transaction is not one request_payment call");
  }
  if (calls[0].deposit !== "0") {
    throw new Error("Recovered failed-transfer transaction attached an unexpected deposit");
  }
  const args = decodeBase64Json(calls[0].args, "request_payment arguments");
  const expectedArgs = {
    recipient_hash: expected.failureHash,
    amount: expected.amountYocto,
    chain: "near",
    token: "NEAR",
    recipient_account_id: expected.failureAccountId,
  };
  if (!sameRecord(args, expectedArgs)) {
    throw new Error("Recovered failed-transfer transaction arguments do not match the probe");
  }

  const encodedResult = transaction.status?.SuccessValue;
  if (!encodedResult || encodedResult !== evidence.status.SuccessValue) {
    throw new Error("Recovered failed-transfer transaction result does not match its evidence");
  }
  const result = parsePaymentResult(decodeBase64Json(encodedResult, "transaction result"));
  if (
    result.approved ||
    result.settled ||
    result.reason !== expected.reason ||
    result.payment_id !== evidence.decision.payment_id
  ) {
    throw new Error("Recovered failed-transfer transaction returned an unexpected decision");
  }

  const decisions = paymentDecisions(transaction, expected.contractId).filter(
    (decision) => decision.payment_id === result.payment_id,
  );
  if (decisions.length !== 1) {
    throw new Error("Recovered failed-transfer transaction must emit exactly one matching decision");
  }
  const decision = decisions[0];
  if (
    !decision ||
    decision.block_height !== evidence.decision.block_height ||
    decision.outcome.Rejected !== expected.reason
  ) {
    throw new Error("Recovered failed-transfer event does not match its evidence");
  }
  return {
    transactionHash: evidence.transaction_hash,
    result: { ...result, transaction_hash: evidence.transaction_hash },
    decision,
  };
}

export function verifyRecoveredUnauthorizedTransaction(
  evidence: unknown,
  transaction: FinalTransactionOutcome,
  expected: UnauthorizedExpectations,
): { result: PaymentResult; transactionHash: string } {
  const identity = recoveredUnauthorizedTransactionIdentity(evidence);
  const root = requireRecord(evidence, "recovered initial transaction evidence");
  const transactions = requireRecord(root.transactions, "recovered transactions");
  const recovered = requireRecord(
    transactions.unauthorized_worker_request,
    "recovered unauthorized transaction",
  );
  if (
    identity.sender !== expected.workerAccountId ||
    recovered.final_execution_status !== "FINAL"
  ) {
    throw new Error("Recovered unauthorized evidence has an unexpected sender or finality");
  }

  if (
    transaction.final_execution_status !== "FINAL" ||
    transaction.status?.Failure ||
    transaction.transaction?.hash !== identity.transactionHash
  ) {
    throw new Error("Recovered unauthorized transaction is not successful and final");
  }
  if (
    transaction.transaction.signer_id !== expected.workerAccountId ||
    transaction.transaction.receiver_id !== expected.contractId
  ) {
    throw new Error("Recovered unauthorized transaction has an unexpected signer or receiver");
  }
  const calls = (transaction.transaction.actions ?? []).flatMap((action) =>
    action.FunctionCall ? [action.FunctionCall] : [],
  );
  if (calls.length !== 1 || calls[0]?.method_name !== "request_payment") {
    throw new Error("Recovered unauthorized transaction is not one request_payment call");
  }
  if (calls[0].deposit !== "0") {
    throw new Error("Recovered unauthorized transaction attached an unexpected deposit");
  }
  const args = decodeBase64Json(calls[0].args, "unauthorized request arguments");
  const expectedArgs = {
    amount: expected.amountYocto,
    chain: "near",
    recipient_account_id: expected.workerAccountId,
    recipient_hash: expected.recipientHash,
    token: "NEAR",
  };
  if (!sameRecord(args, expectedArgs)) {
    throw new Error("Recovered unauthorized transaction arguments do not match the probe");
  }

  const encodedResult = transaction.status?.SuccessValue;
  const recoveredStatus = requireRecord(recovered.status, "recovered unauthorized status");
  if (
    !encodedResult ||
    encodedResult !== requireString(recoveredStatus.SuccessValue, "unauthorized SuccessValue")
  ) {
    throw new Error("Recovered unauthorized transaction result does not match its evidence");
  }
  const result = parsePaymentResult(decodeBase64Json(encodedResult, "unauthorized result"));
  if (
    result.approved ||
    result.settled ||
    result.payment_id !== 0 ||
    result.reason !== expected.reason
  ) {
    throw new Error("Recovered unauthorized transaction returned an unexpected decision");
  }
  if (paymentDecisions(transaction, expected.contractId).length !== 0) {
    throw new Error("Unauthorized transaction unexpectedly emitted a payment decision");
  }
  return {
    transactionHash: identity.transactionHash,
    result: { ...result, transaction_hash: identity.transactionHash },
  };
}

export function recoveredUnauthorizedTransactionIdentity(evidence: unknown): {
  sender: string;
  transactionHash: string;
} {
  const root = requireRecord(evidence, "recovered initial transaction evidence");
  if (root.network !== "testnet") {
    throw new Error("Recovered unauthorized evidence is not for testnet");
  }
  const transactions = requireRecord(root.transactions, "recovered transactions");
  const recovered = requireRecord(
    transactions.unauthorized_worker_request,
    "recovered unauthorized transaction",
  );
  const transactionHash = requireString(recovered.hash, "unauthorized transaction hash");
  if (!TRANSACTION_HASH_PATTERN.test(transactionHash)) {
    throw new Error("Recovered unauthorized evidence has an invalid transaction hash");
  }
  return {
    sender: requireString(recovered.sender, "unauthorized transaction sender"),
    transactionHash,
  };
}

function paymentDecisions(
  transaction: FinalTransactionOutcome,
  contractId: string,
): FailedTransferDecision[] {
  const decisions: FailedTransferDecision[] = [];
  for (const receipt of transaction.receipts_outcome ?? []) {
    if (receipt.outcome?.executor_id !== contractId) continue;
    for (const log of receipt.outcome.logs ?? []) {
      if (!log.startsWith("EVENT_JSON:")) continue;
      let event: unknown;
      try {
        event = JSON.parse(log.slice("EVENT_JSON:".length)) as unknown;
      } catch {
        continue;
      }
      if (!isRecord(event) || event.standard !== "clavis" || event.event !== "payment_decision") {
        continue;
      }
      if (!Array.isArray(event.data)) continue;
      for (const item of event.data) {
        if (!isRecord(item) || !isRecord(item.outcome)) continue;
        try {
          decisions.push({
            block_height: requirePositiveSafeInteger(item.block_height, "event block_height"),
            outcome: {
              Rejected: requireString(item.outcome.Rejected, "event outcome.Rejected"),
            },
            payment_id: requirePositiveSafeInteger(item.payment_id, "event payment_id"),
            timestamp: requireTimestamp(item.timestamp),
          });
        } catch {
          // Ignore unrelated or malformed event payloads; the exact expected event is required later.
        }
      }
    }
  }
  return decisions;
}

function parsePaymentResult(value: unknown): PaymentResult {
  const result = requireRecord(value, "payment result");
  if (typeof result.approved !== "boolean" || typeof result.settled !== "boolean") {
    throw new Error("Payment result has invalid approval fields");
  }
  return {
    approved: result.approved,
    payment_id: requireNonNegativeSafeInteger(result.payment_id, "payment result payment_id"),
    reason:
      result.reason === null || result.reason === undefined
        ? null
        : requireString(result.reason, "payment result reason"),
    settled: result.settled,
  };
}

function sameRecord(actual: unknown, expected: Record<string, unknown>): boolean {
  if (!isRecord(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    JSON.stringify(actualKeys) === JSON.stringify(expectedKeys) &&
    expectedKeys.every((key) => actual[key] === expected[key])
  );
}

function decodeBase64Json(value: unknown, label: string): unknown {
  const encoded = requireString(value, label);
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as unknown;
  } catch {
    throw new Error(`${label} is not valid base64 JSON`);
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireDigits(value: unknown, label: string): string {
  const parsed = requireString(value, label);
  if (!/^\d+$/u.test(parsed)) throw new Error(`${label} must contain only digits`);
  return parsed;
}

function requireNullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return requireString(value, label);
}

function requirePositiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function requireNonNegativeSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function requireTimestamp(value: unknown): number | string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/u.test(value)) return value;
  throw new Error("decision timestamp must be a positive number or digit string");
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
