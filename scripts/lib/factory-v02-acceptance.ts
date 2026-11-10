import assert from "node:assert/strict";

import {
  decodeFunctionArgs,
  decodeSuccessValue,
  functionCall,
  sha256,
  transactionLogs,
  type AccessKeyView,
  type FinalTransaction,
} from "./factory-v02-live.js";

export interface FunctionTransactionExpectation {
  args: Record<string, unknown>;
  depositYocto: string;
  methodName: string;
  receiverId: string;
  signerId: string;
}

export interface PaymentResult {
  approved: boolean;
  payment_id: number;
  reason?: string | null;
  settled: boolean;
}

interface Nep297Event {
  data?: unknown[];
  event?: string;
  standard?: string;
  version?: string;
}

export function assertFunctionTransaction(
  transaction: FinalTransaction,
  expected: FunctionTransactionExpectation,
): void {
  assert.equal(transaction.final_execution_status, "FINAL", "transaction finality");
  assert.equal(transaction.transaction?.signer_id, expected.signerId, "transaction signer");
  assert.equal(transaction.transaction?.receiver_id, expected.receiverId, "transaction receiver");
  const call = functionCall(transaction);
  assert.equal(call.method_name, expected.methodName, "function method");
  assert.equal(call.deposit, expected.depositYocto, "attached deposit");
  assert.deepEqual(decodeFunctionArgs(call), expected.args, "function arguments");
}

export function assertSuccessfulTransaction(transaction: FinalTransaction): unknown {
  assert.equal(transaction.final_execution_status, "FINAL", "transaction finality");
  if (transaction.status?.Failure) {
    throw new Error(`Expected transaction success, received ${JSON.stringify(transaction.status)}`);
  }
  return decodeSuccessValue(transaction);
}

export function assertFailedTransaction(
  transaction: FinalTransaction,
  expectedMessage: string,
): void {
  assert.equal(transaction.final_execution_status, "FINAL", "transaction finality");
  const failure = transaction.status?.Failure;
  if (!failure) throw new Error("Expected a failed transaction outcome");
  const serialized = JSON.stringify(failure);
  if (!serialized.includes(expectedMessage)) {
    throw new Error(`Transaction failure did not include ${JSON.stringify(expectedMessage)}`);
  }
}

export function parsePaymentResult(value: unknown): PaymentResult {
  if (!isRecord(value)) throw new Error("Payment result is not an object");
  if (
    typeof value.approved !== "boolean" ||
    !Number.isSafeInteger(value.payment_id) ||
    typeof value.settled !== "boolean" ||
    (value.reason !== undefined && value.reason !== null && typeof value.reason !== "string")
  ) {
    throw new Error(`Invalid payment result ${JSON.stringify(value)}`);
  }
  return {
    approved: value.approved,
    payment_id: value.payment_id as number,
    ...(value.reason === undefined ? {} : { reason: value.reason as string | null }),
    settled: value.settled,
  };
}

export function assertApprovedPayment(value: unknown): PaymentResult {
  const result = parsePaymentResult(value);
  if (!result.approved || !result.settled || result.reason != null || result.payment_id < 1) {
    throw new Error(`Expected settled approval, received ${JSON.stringify(result)}`);
  }
  return result;
}

export function assertRejectedPayment(value: unknown, reason: string): PaymentResult {
  const result = parsePaymentResult(value);
  if (result.approved || result.settled || result.reason !== reason || result.payment_id < 1) {
    throw new Error(`Expected rejection ${JSON.stringify(reason)}, received ${JSON.stringify(result)}`);
  }
  return result;
}

export function findEvent(
  transaction: FinalTransaction,
  standard: string,
  eventName: string,
): Nep297Event {
  const events = transactionLogs(transaction)
    .filter((log) => log.startsWith("EVENT_JSON:"))
    .map((log) => JSON.parse(log.slice("EVENT_JSON:".length)) as unknown)
    .filter(isRecord)
    .filter((event) => event.standard === standard && event.event === eventName);
  if (events.length !== 1) {
    throw new Error(`Expected one ${standard}/${eventName} event, received ${events.length}`);
  }
  return events[0] as Nep297Event;
}

export function normalizeAccessKeys(keys: AccessKeyView[]): Array<{
  permission: unknown;
  public_key: string;
}> {
  return keys
    .map((entry) => ({
      permission: entry.access_key.permission,
      public_key: entry.public_key,
    }))
    .sort((left, right) => left.public_key.localeCompare(right.public_key));
}

export function explorerTransactionUrl(hash: string): string {
  return `https://testnet.nearblocks.io/txns/${hash}`;
}

export function deployContractSha256(encodedCodeOrHash: string): string {
  const value = Buffer.from(encodedCodeOrHash, "base64");
  return value.length === 32 ? value.toString("hex") : sha256(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
