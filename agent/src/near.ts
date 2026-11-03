import { keyStores, KeyPair, Near, type Account } from "near-api-js";

import type {
  AuditEntry,
  ContractRecord,
  PaymentResult,
  RecipientView,
} from "./types.js";

export const DEFAULT_TESTNET_RPC_URL = "https://rpc.testnet.fastnear.com";

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

export class NearRpcClient {
  readonly rpcUrl: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl.trim() || DEFAULT_TESTNET_RPC_URL;
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
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "clavis-agent",
        method,
        params,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`NEAR RPC request failed with HTTP ${response.status}`);
    }

    const body = (await response.json()) as RpcResponse<T>;
    if (body.error || body.result === undefined) {
      throw new Error(body.error?.message ?? "NEAR RPC returned an invalid response");
    }
    return body.result;
  }
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
      walletUrl: "",
      helperUrl: "",
      keyStore,
    });
    this.#account = await near.account(this.#options.accountId);
  }

  async verifyAgentKey(allowFullAccess: boolean): Promise<"restricted" | "full-access"> {
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

    if (accessKey.permission === "FullAccess") {
      if (!allowFullAccess) {
        throw new Error(
          "Refusing to start with a Full Access agent key. Set ALLOW_FULL_ACCESS_AGENT=true only for the shared testnet operator account.",
        );
      }
      return "full-access";
    }

    const permission = accessKey.permission.FunctionCall;
    if (
      permission.receiver_id !== this.#options.contractId ||
      permission.method_names.length !== 1 ||
      permission.method_names[0] !== "request_payment"
    ) {
      throw new Error(
        `Agent key must only call request_payment on ${this.#options.contractId}`,
      );
    }
    return "restricted";
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

  async requestPayment(args: {
    recipientHash: string;
    amountYocto: string;
    chain: string;
    token: string;
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
      },
      gas: 100_000_000_000_000n,
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
    return JSON.parse(decoded) as PaymentResult;
  }

  view<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.#rpc.view<T>(this.#options.contractId, methodName, args);
  }
}

export class NearTransferClient {
  readonly #options: Omit<NearClientOptions, "contractId">;
  readonly #keyPair: KeyPair;
  #account: Account | null = null;

  constructor(options: Omit<NearClientOptions, "contractId">) {
    this.#options = {
      ...options,
      rpcUrl: options.rpcUrl.trim() || DEFAULT_TESTNET_RPC_URL,
    };
    this.#keyPair = KeyPair.fromString(
      options.privateKey as `ed25519:${string}` | `secp256k1:${string}`,
    );
  }

  async connect(): Promise<void> {
    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(this.#options.networkId, this.#options.accountId, this.#keyPair);
    const near = new Near({
      networkId: this.#options.networkId,
      nodeUrl: this.#options.rpcUrl,
      walletUrl: "",
      helperUrl: "",
      keyStore,
    });
    this.#account = await near.account(this.#options.accountId);
  }

  async transferNear(receiverId: string, amountYocto: string): Promise<string> {
    if (!this.#account) throw new Error("Settlement client is not connected");
    if (!/^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(receiverId)) {
      throw new Error("A valid NEAR testnet recipient is required for fallback transfer");
    }
    const outcome = (await this.#account.sendMoney(
      receiverId,
      BigInt(amountYocto),
    )) as TransactionOutcome;
    if (outcome.status.Failure) {
      throw new Error("Direct NEAR fallback transfer failed");
    }
    return outcome.transaction.hash;
  }
}
