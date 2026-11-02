import { keyStores, KeyPair, Near, type Account } from "near-api-js";

import type { AuditEntry, PaymentResult, RecipientView } from "./types.js";

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

export interface NearClientOptions {
  networkId: string;
  rpcUrl: string;
  accountId: string;
  privateKey: string;
  contractId: string;
}

export class NearClient {
  readonly #options: NearClientOptions;
  readonly #keyPair: KeyPair;
  #account: Account | null = null;

  constructor(options: NearClientOptions) {
    this.#options = options;
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

  async verifyRestrictedKey(): Promise<void> {
    const configuredAgent = await this.view<string>("get_agent", {});
    if (configuredAgent !== this.#options.accountId) {
      throw new Error("The configured account is not the contract's authorized agent");
    }

    const accessKey = await this.rpc<AccessKeyResult>({
      request_type: "view_access_key",
      finality: "final",
      account_id: this.#options.accountId,
      public_key: this.#keyPair.getPublicKey().toString(),
    });

    if (accessKey.permission === "FullAccess") {
      throw new Error("Refusing to start: the payroll agent key has Full Access permissions");
    }

    const permission = accessKey.permission.FunctionCall;
    if (
      permission.receiver_id !== this.#options.contractId ||
      permission.method_names.length !== 1 ||
      permission.method_names[0] !== "request_payment"
    ) {
      throw new Error(
        "Refusing to start: the agent key must only call request_payment on the Clavis contract",
      );
    }
  }

  async getRecipients(): Promise<RecipientView[]> {
    return this.view<RecipientView[]>("get_recipients", { from: 0, limit: 100 });
  }

  async getAuditLog(limit = 100): Promise<AuditEntry[]> {
    return this.view<AuditEntry[]>("get_audit_log_reverse", { from: 0, limit });
  }

  async getDailySpent(): Promise<string> {
    return this.view<string>("get_daily_spent", {});
  }

  async getDailyLimit(): Promise<string> {
    return this.view<string>("get_daily_limit", {});
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

    const outcome = await this.#account.functionCall({
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
    });

    const status = outcome.status as ExecutionStatus;
    if (status.Failure) {
      throw new Error("The request_payment transaction failed");
    }
    if (status.SuccessValue === undefined) {
      throw new Error("The request_payment transaction returned no result");
    }

    const decoded = Buffer.from(status.SuccessValue, "base64").toString("utf8");
    return JSON.parse(decoded) as PaymentResult;
  }

  private async view<T>(methodName: string, args: Record<string, unknown>): Promise<T> {
    const response = await this.rpc<CallFunctionResult>({
      request_type: "call_function",
      finality: "final",
      account_id: this.#options.contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    const decoded = Buffer.from(response.result).toString("utf8");
    return JSON.parse(decoded) as T;
  }

  private async rpc<T>(query: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.#options.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "clavis-agent",
        method: "query",
        params: query,
      }),
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
