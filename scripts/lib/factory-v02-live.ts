import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface AccountView {
  amount: string;
  code_hash: string;
  storage_usage: number;
}

export interface AccessKeyView {
  access_key: {
    nonce: number;
    permission: unknown;
  };
  public_key: string;
}

export interface FunctionCallAction {
  args?: string;
  deposit?: string;
  gas?: number;
  method_name?: string;
}

export interface FinalTransaction {
  final_execution_status?: string;
  receipts_outcome?: Array<{
    outcome?: {
      executor_id?: string;
      logs?: string[];
      status?: unknown;
    };
  }>;
  status?: { Failure?: unknown; SuccessValue?: string };
  transaction?: {
    actions?: Array<{
      DeployContract?: { code?: string };
      FunctionCall?: FunctionCallAction;
    }>;
    hash?: string;
    receiver_id?: string;
    signer_id?: string;
  };
}

interface JsonRpcEnvelope<T> {
  error?: {
    cause?: { name?: string };
    data?: unknown;
    message?: string;
  };
  result?: T;
}

interface NearTransactionOptions {
  args: Record<string, unknown>;
  deposit: string;
  evidenceDirectory: string;
  gas: string;
  label: string;
  methodName: string;
  networkName?: string;
  publicKey: string;
  receiverId: string;
  signerId: string;
}

export interface NearTransactionSubmission {
  exitCode: number;
  hash: string;
  logPath: string;
}

const TRANSACTION_HASH_PATTERN = /Transaction ID:\s*([1-9A-HJ-NP-Za-km-z]{43,44})/u;

/** Minimal finality-only NEAR Testnet RPC client for acceptance evidence. */
export class TestnetRpc {
  readonly rpcUrl: string;
  readonly rpcUrls: string[];

  constructor(rpcUrl: string, fallbackRpcUrls: string[] = []) {
    this.rpcUrl = rpcUrl.replace(/\/$/u, "");
    this.rpcUrls = [...new Set([this.rpcUrl, ...fallbackRpcUrls.map((url) => url.replace(/\/$/u, ""))])];
  }

  async assertTestnet(): Promise<void> {
    const status = await this.call<{ chain_id: string }>("status", []);
    if (status.chain_id !== "testnet") {
      throw new Error(`Refusing unexpected NEAR chain ${status.chain_id}`);
    }
  }

  async account(accountId: string, allowMissing = false): Promise<AccountView | null> {
    try {
      return await this.query<AccountView>({
        account_id: accountId,
        finality: "final",
        request_type: "view_account",
      });
    } catch (reason) {
      if (allowMissing && isMissingAccountError(reason)) return null;
      throw reason;
    }
  }

  async accessKeys(accountId: string): Promise<AccessKeyView[]> {
    const result = await this.query<{ keys: AccessKeyView[] }>({
      account_id: accountId,
      finality: "final",
      request_type: "view_access_key_list",
    });
    return result.keys;
  }

  async codeSha256(accountId: string): Promise<string> {
    const result = await this.query<{ code_base64: string }>({
      account_id: accountId,
      finality: "final",
      request_type: "view_code",
    });
    return sha256(Buffer.from(result.code_base64, "base64"));
  }

  async transaction(hash: string, senderAccountId: string): Promise<FinalTransaction> {
    return this.call<FinalTransaction>("tx", {
      sender_account_id: senderAccountId,
      tx_hash: hash,
      wait_until: "FINAL",
    });
  }

  async view<T>(accountId: string, methodName: string, args: unknown = {}): Promise<T> {
    const result = await this.query<{ result: number[] }>({
      account_id: accountId,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      finality: "final",
      method_name: methodName,
      request_type: "call_function",
    });
    return JSON.parse(Buffer.from(result.result).toString("utf8")) as T;
  }

  private query<T>(parameters: Record<string, unknown>): Promise<T> {
    return this.call<T>("query", parameters);
  }

  private async call<T>(method: string, params: unknown): Promise<T> {
    const transientErrors: string[] = [];
    for (const rpcUrl of this.rpcUrls) {
      let response: Response;
      try {
        response = await fetch(rpcUrl, {
          body: JSON.stringify({ jsonrpc: "2.0", id: "clavis-factory-v02", method, params }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout(20_000),
        });
      } catch (reason) {
        transientErrors.push(`${rpcUrl}: ${errorMessage(reason)}`);
        continue;
      }
      if (!response.ok) {
        const message = `NEAR RPC returned HTTP ${response.status}`;
        if (response.status === 429 || response.status >= 500) {
          transientErrors.push(`${rpcUrl}: ${message}`);
          continue;
        }
        throw new Error(message);
      }
      let body: JsonRpcEnvelope<T>;
      try {
        body = (await response.json()) as JsonRpcEnvelope<T>;
      } catch (reason) {
        transientErrors.push(`${rpcUrl}: invalid JSON (${errorMessage(reason)})`);
        continue;
      }
      if (body.error || body.result === undefined) {
        const detail = body.error?.data ?? body.error?.message ?? "Invalid NEAR RPC response";
        const message = typeof detail === "string" ? detail : JSON.stringify(detail);
        if (isTransientRpcError(message)) {
          transientErrors.push(`${rpcUrl}: ${message}`);
          continue;
        }
        throw new Error(message);
      }
      return body.result;
    }
    throw new Error(`Every NEAR Testnet RPC failed: ${transientErrors.join(" | ")}`);
  }
}

/** Submit one keychain-backed function call and persist the complete public CLI transcript. */
export async function submitNearTransaction(
  nearBinary: string,
  options: NearTransactionOptions,
): Promise<NearTransactionSubmission> {
  const command = [
    "contract",
    "call-function",
    "as-transaction",
    options.receiverId,
    options.methodName,
    "json-args",
    JSON.stringify(options.args),
    "prepaid-gas",
    options.gas,
    "attached-deposit",
    options.deposit,
    "sign-as",
    options.signerId,
    "network-config",
    options.networkName ?? "testnet",
    "sign-with-keychain",
    "--signer-public-key",
    options.publicKey,
    "send",
    "--wait-until",
    "final",
  ];
  const result = spawnSync(nearBinary, command, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const transcript = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  await mkdir(options.evidenceDirectory, { recursive: true, mode: 0o700 });
  const logPath = path.join(options.evidenceDirectory, `${options.label}.log`);
  await writeFile(logPath, transcript, { mode: 0o600 });
  await chmod(logPath, 0o600);
  const hash = parseTransactionHash(transcript);
  return { exitCode: result.status ?? 1, hash, logPath };
}

/** Resolve a stored signer through near-cli without exposing its private key. */
export function verifyKeychainIdentity(
  nearBinary: string,
  accountId: string,
  expectedPublicKey: string,
  networkName = "testnet",
): void {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = spawnSync(
      nearBinary,
      ["account", "get-public-key", "from-keychain", accountId, "network-config", networkName],
      { encoding: "utf8", env: process.env },
    );
    if (result.error) throw result.error;
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (result.status === 0 && output.includes(expectedPublicKey)) return;
    if (attempt < 3) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 250);
    }
  }
  throw new Error(`Secure keychain identity verification failed for ${accountId}`);
}

export function parseTransactionHash(output: string): string {
  const match = stripAnsi(output).match(TRANSACTION_HASH_PATTERN);
  if (!match?.[1]) throw new Error("NEAR CLI output did not contain a transaction hash");
  return match[1];
}

export function decodeSuccessValue(transaction: FinalTransaction): unknown {
  const encoded = transaction.status?.SuccessValue;
  if (encoded === undefined) throw new Error("Transaction did not finish with SuccessValue");
  if (encoded === "") return null;
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  return JSON.parse(decoded) as unknown;
}

export function functionCall(transaction: FinalTransaction): FunctionCallAction {
  const actions = transaction.transaction?.actions ?? [];
  const calls = actions.flatMap((action) => (action.FunctionCall ? [action.FunctionCall] : []));
  if (actions.length !== 1 || calls.length !== 1 || !calls[0]) {
    throw new Error("Expected exactly one function-call action");
  }
  return calls[0];
}

export function decodeFunctionArgs(call: FunctionCallAction): unknown {
  if (!call.args) throw new Error("Function-call arguments are missing");
  return JSON.parse(Buffer.from(call.args, "base64").toString("utf8")) as unknown;
}

export function transactionLogs(transaction: FinalTransaction): string[] {
  return (transaction.receipts_outcome ?? []).flatMap((receipt) => receipt.outcome?.logs ?? []);
}

export function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function writePrivateJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "");
}

function isMissingAccountError(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason);
  return /UNKNOWN_ACCOUNT|does not exist|account.*not found/iu.test(message);
}

function isTransientRpcError(message: string): boolean {
  return /429|rate.?limit|too many requests|timeout|timed out|temporar|unavailable|deprecated endpoint|unknown block/iu.test(
    message,
  );
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
