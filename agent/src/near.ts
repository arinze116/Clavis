import { keyStores, KeyPair, Near, providers, type Account } from "near-api-js";

import type {
  AuditEntry,
  ContractRecord,
  PaymentResult,
  RecipientView,
} from "./types.js";

export const DEFAULT_TESTNET_RPC_URL = "https://near-testnet.drpc.org";
export const TESTNET_RPC_FALLBACK_URLS = [
  "https://testnet-rpc.intea.rs",
  "https://archival-rpc.testnet.near.org",
  "https://test.rpc.fastnear.com",
] as const;

interface RpcResponse<T> {
  result?: T;
  error?: { message?: string; data?: unknown };
}

interface CallFunctionResult {
  result: number[];
}

interface AccessKeyResult {
  permission:
    | "FullAccess"
    | {
        FunctionCall: {
          allowance: string | null;
          receiver_id: string;
          method_names: string[];
        };
      };
}

interface ExecutionStatus {
  SuccessValue?: string;
  Failure?: unknown;
}

interface TransactionOutcome {
  status: ExecutionStatus;
  transaction: { hash: string };
}

export interface NearClientOptions {
  networkId: string;
  rpcUrl: string;
  accountId: string;
  privateKey: string;
  contractId: string;
}

export function assertRestrictedAgentAccessKey(
  accessKey: AccessKeyResult,
  contractId: string,
): void {
  if (accessKey.permission === "FullAccess") {
    throw new Error(
      "Refusing to start with a Full Access agent key; create a Function Call key restricted to request_payment",
    );
  }

  const permission = accessKey.permission.FunctionCall;
  if (
    permission.receiver_id !== contractId ||
    permission.method_names.length !== 1 ||
    permission.method_names[0] !== "request_payment"
  ) {
    throw new Error(`Agent key must only call request_payment on ${contractId}`);
  }
}

export function assertContractControlledSettlementVersion(version: string): void {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    throw new Error(`Payroll contract returned an invalid version: ${version}`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major === 0 && minor < 3) {
    throw new Error(
      `Payroll contract ${version} is not scheduler-compatible; v0.3.0 or newer is required for on-chain milestone idempotency`,
    );
  }
}

export class NearRpcClient {
  readonly rpcUrl: string;
  readonly rpcUrls: readonly string[];

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl.trim() || DEFAULT_TESTNET_RPC_URL;
    this.rpcUrls = [...new Set([this.rpcUrl, ...TESTNET_RPC_FALLBACK_URLS])];
  }

  async view<T>(
    contractId: string,
    methodName: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const response = await this.rpc<CallFunctionResult>({
      request_type: "call_function",
      finality: "final",
      account_id: contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    const decoded = Buffer.from(response.result).toString("utf8");
    return JSON.parse(decoded) as T;
  }

  async rpc<T>(query: Record<string, unknown>): Promise<T> {
    return this.jsonRpc<T>("query", query);
  }

  async jsonRpc<T>(method: string, params: unknown): Promise<T> {
    const encodedRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: "clavis-agent",
      method,
      params,
    });
    let lastError: unknown;
    for (const rpcUrl of this.rpcUrls) {
      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: encodedRequest,
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) {
          const error = new Error(`NEAR RPC request failed with HTTP ${response.status}`);
          if (isRetryableHttpStatus(response.status)) {
            lastError = error;
            continue;
          }
          throw error;
        }

        const body = (await response.json()) as RpcResponse<T>;
        if (body.error || body.result === undefined) {
          const error = new Error(body.error?.message ?? "NEAR RPC returned an invalid response");
          if (isRetryableRpcError(body.error)) {
            lastError = error;
            continue;
          }
          throw error;
        }
        return body.result;
      } catch (error) {
        lastError = error;
        if (error instanceof Error && !isTransientNetworkError(error)) throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("No NEAR Testnet RPC endpoint was available");
  }
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableRpcError(error: RpcResponse<unknown>["error"]): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("rate limit") || message.includes("endpoint is deprecated");
}

function isTransientNetworkError(error: Error): boolean {
  return error.name === "AbortError" || error.name === "TimeoutError" || error instanceof TypeError;
}

export class FactoryClient {
  readonly #rpc: NearRpcClient;
  readonly #factoryContractId: string;

  constructor(options: { rpcUrl: string; factoryContractId: string }) {
    this.#rpc = new NearRpcClient(options.rpcUrl);
    this.#factoryContractId = options.factoryContractId;
  }

  getAllContracts(): Promise<ContractRecord[]> {
    return this.#rpc.view<ContractRecord[]>(
      this.#factoryContractId,
      "get_all_contracts",
    );
  }
}

export class NearClient {
  readonly #options: NearClientOptions;
  readonly #keyPair: KeyPair;
  readonly #rpc: NearRpcClient;
  #account: Account | null = null;

  constructor(options: NearClientOptions) {
    this.#options = {
      ...options,
      rpcUrl: options.rpcUrl.trim() || DEFAULT_TESTNET_RPC_URL,
    };
    this.#rpc = new NearRpcClient(this.#options.rpcUrl);
    this.#keyPair = KeyPair.fromString(
      options.privateKey as `ed25519:${string}` | `secp256k1:${string}`,
    );
  }

  get contractId(): string {
    return this.#options.contractId;
  }

  async connect(): Promise<void> {
    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(this.#options.networkId, this.#options.accountId, this.#keyPair);
    const near = new Near({
      networkId: this.#options.networkId,
      nodeUrl: this.#options.rpcUrl,
      provider: new providers.FailoverRpcProvider(
        this.#rpc.rpcUrls.map(
          (url) => new providers.JsonRpcProvider({ url }, { retries: 0, wait: 0, backoff: 1 }),
        ),
      ),
      walletUrl: "",
      helperUrl: "",
      keyStore,
    });
    this.#account = await near.account(this.#options.accountId);
  }

  async verifyAgentKey(): Promise<"restricted"> {
    const configuredAgent = await this.view<string>("get_agent");
    if (configuredAgent !== this.#options.accountId) {
      throw new Error(
        `${this.#options.accountId} is not the authorized agent for ${this.#options.contractId}`,
      );
    }

    const accessKey = await this.#rpc.rpc<AccessKeyResult>({
      request_type: "view_access_key",
      finality: "final",
      account_id: this.#options.accountId,
      public_key: this.#keyPair.getPublicKey().toString(),
    });

    assertRestrictedAgentAccessKey(accessKey, this.#options.contractId);
    return "restricted";
  }

  async verifyContractVersion(): Promise<string> {
    const version = await this.view<string>("contract_version");
    assertContractControlledSettlementVersion(version);
    return version;
  }

  async getRecipients(): Promise<RecipientView[]> {
    return this.view<RecipientView[]>("get_recipients", { from: 0, limit: 100 });
  }

  async getAuditLog(limit = 100): Promise<AuditEntry[]> {
    return this.view<AuditEntry[]>("get_audit_log_reverse", { from: 0, limit });
  }

  async getDailySpent(): Promise<string> {
    return this.view<string>("get_daily_spent");
  }

  async getDailyLimit(): Promise<string> {
    return this.view<string>("get_daily_limit");
  }

  async getLastResetTimestamp(): Promise<number> {
    return this.view<number>("get_last_reset_timestamp");
  }

  async requestPayment(args: {
    recipientHash: string;
    recipientAccountId: string;
    amountYocto: string;
    chain: string;
    token: string;
    paymentReference?: string;
  }): Promise<PaymentResult> {
    if (!this.#account) {
      throw new Error("NEAR client is not connected");
    }

    const outcome = (await this.#account.functionCall({
      contractId: this.#options.contractId,
      methodName: "request_payment",
      args: {
        recipient_hash: args.recipientHash,
        amount: args.amountYocto,
        chain: args.chain,
        token: args.token,
        recipient_account_id: args.recipientAccountId,
        ...(args.paymentReference
          ? { payment_reference: args.paymentReference }
          : {}),
      },
      gas: 150_000_000_000_000n,
      attachedDeposit: 0n,
    })) as TransactionOutcome;

    const status = outcome.status;
    if (status.Failure) {
      throw new Error("The request_payment transaction failed");
    }
    if (status.SuccessValue === undefined) {
      throw new Error("The request_payment transaction returned no result");
    }

    const decoded = Buffer.from(status.SuccessValue, "base64").toString("utf8");
    const result = JSON.parse(decoded) as Omit<PaymentResult, "transaction_hash">;
    return { ...result, transaction_hash: outcome.transaction.hash };
  }

  async isPaymentReferenceCompleted(
    recipientHash: string,
    paymentReference: string,
  ): Promise<boolean> {
    return this.view<boolean>("is_payment_reference_completed", {
      recipient_hash: recipientHash,
      payment_reference: paymentReference,
    });
  }

  view<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.#rpc.view<T>(this.#options.contractId, methodName, args);
  }
}
