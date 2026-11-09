import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  businessPayrollSchema,
  nearAccountPattern,
  validateBusinessPayroll,
} from "./payroll.js";
import type { BusinessPayroll, PayrollRecipient } from "./types.js";

const DEFAULT_OWNER_EMAIL = "notifications-disabled@example.com";
const PENDING_OPERATIONS_FILE = ".pending-payroll-operations.json";
const PENDING_OPERATION_TTL_MS = 24 * 60 * 60 * 1_000;

export interface ExpectedRecipientPolicy {
  name: string;
  personalCapYocto: string;
  active: boolean;
  preferredChain: string;
  preferredToken: string;
  paymentSplit: Array<{ chain: string; token: string; percentage: number }>;
  schedule: string;
}

export type PendingPayrollOperation =
  | {
      operationId: string;
      action: "upsert";
      contractId: string;
      recipientHash: string;
      recipient: PayrollRecipient;
      expectedPolicy: ExpectedRecipientPolicy;
      ownerEmail?: string;
      telegramChatId?: string;
      createdAt: string;
      expiresAt: string;
    }
  | {
      operationId: string;
      action: "remove";
      contractId: string;
      recipientHash: string;
      ownerEmail?: string;
      telegramChatId?: string;
      createdAt: string;
      expiresAt: string;
    };

type PendingPayrollOperationInput =
  | Omit<
      Extract<PendingPayrollOperation, { action: "upsert" }>,
      "operationId" | "createdAt" | "expiresAt"
    >
  | Omit<
      Extract<PendingPayrollOperation, { action: "remove" }>,
      "operationId" | "createdAt" | "expiresAt"
    >;

export class PayrollPlanStore {
  readonly #directory: string;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(directory: string) {
    this.#directory = directory;
  }

  async get(contractId: string): Promise<BusinessPayroll | null> {
    assertContractId(contractId);
    return this.read(contractId);
  }

  sync(options: {
    contractId: string;
    recipients: PayrollRecipient[];
    ownerEmail?: string | null;
    telegramChatId?: string | null;
  }): Promise<{ recipientCount: number }> {
    return this.enqueue(async () => {
      const existing = await this.read(options.contractId);
      const plan = validateBusinessPayroll(
        businessPayrollSchema.parse({
          contract_id: options.contractId,
          owner_email: options.ownerEmail ?? existing?.owner_email ?? DEFAULT_OWNER_EMAIL,
          telegram_chat_id:
            options.telegramChatId ?? existing?.telegram_chat_id ?? undefined,
          recipients: options.recipients,
        }) as BusinessPayroll,
      );
      await this.write(plan);
      return { recipientCount: plan.recipients.length };
    });
  }

  upsert(options: {
    contractId: string;
    recipient: PayrollRecipient;
    ownerEmail?: string | null;
    telegramChatId?: string | null;
  }): Promise<{ recipientCount: number }> {
    return this.enqueue(() => this.upsertUnlocked(options));
  }

  remove(options: {
    contractId: string;
    recipientHash: string;
    ownerEmail?: string | null;
    telegramChatId?: string | null;
  }): Promise<{ recipientCount: number; removed: boolean }> {
    return this.enqueue(() => this.removeUnlocked(options));
  }

  prepareUpsert(options: {
    contractId: string;
    recipient: PayrollRecipient;
    expectedPolicy: ExpectedRecipientPolicy;
    ownerEmail?: string | null;
    telegramChatId?: string | null;
  }): Promise<PendingPayrollOperation> {
    return this.enqueue(async () => {
      const existing = await this.read(options.contractId);
      const recipients = [...(existing?.recipients ?? [])];
      const index = recipients.findIndex(
        (recipient) => recipient.recipientHash === options.recipient.recipientHash,
      );
      if (index >= 0) recipients[index] = options.recipient;
      else recipients.push(options.recipient);
      const validated = validateBusinessPayroll(
        businessPayrollSchema.parse({
          contract_id: options.contractId,
          owner_email: options.ownerEmail ?? existing?.owner_email ?? DEFAULT_OWNER_EMAIL,
          telegram_chat_id:
            options.telegramChatId ?? existing?.telegram_chat_id ?? undefined,
          recipients,
        }) as BusinessPayroll,
      );
      const recipient = validated.recipients.find(
        (item) => item.recipientHash === options.recipient.recipientHash,
      );
      if (!recipient) throw new Error("Prepared recipient was not retained after validation");
      const operation = this.pendingOperation({
        action: "upsert",
        contractId: options.contractId,
        recipientHash: recipient.recipientHash,
        recipient,
        expectedPolicy: options.expectedPolicy,
        ...(options.ownerEmail ? { ownerEmail: options.ownerEmail } : {}),
        ...(options.telegramChatId ? { telegramChatId: options.telegramChatId } : {}),
      });
      const pending = (await this.readPending()).filter(
        (item) =>
          item.contractId !== operation.contractId ||
          item.recipientHash !== operation.recipientHash,
      );
      pending.push(operation);
      await this.writePending(pending);
      return operation;
    });
  }

  prepareRemove(options: {
    contractId: string;
    recipientHash: string;
    ownerEmail?: string | null;
    telegramChatId?: string | null;
  }): Promise<PendingPayrollOperation> {
    return this.enqueue(async () => {
      assertContractId(options.contractId);
      assertRecipientHash(options.recipientHash);
      const operation = this.pendingOperation({
        action: "remove",
        contractId: options.contractId,
        recipientHash: options.recipientHash,
        ...(options.ownerEmail ? { ownerEmail: options.ownerEmail } : {}),
        ...(options.telegramChatId ? { telegramChatId: options.telegramChatId } : {}),
      });
      const pending = (await this.readPending()).filter(
        (item) =>
          item.contractId !== operation.contractId ||
          item.recipientHash !== operation.recipientHash,
      );
      pending.push(operation);
      await this.writePending(pending);
      return operation;
    });
  }

  listPending(): Promise<PendingPayrollOperation[]> {
    return this.enqueue(async () => {
      const now = Date.now();
      const pending = await this.readPending();
      const active = pending.filter((operation) => Date.parse(operation.expiresAt) > now);
      if (active.length !== pending.length) await this.writePending(active);
      return active;
    });
  }

  commitPending(operationId: string): Promise<{ recipientCount: number; removed?: boolean }> {
    return this.enqueue(async () => {
      const pending = await this.readPending();
      const operation = pending.find((item) => item.operationId === operationId);
      if (!operation) throw new Error("Pending payroll operation not found or expired");
      const result =
        operation.action === "upsert"
          ? await this.upsertUnlocked({
              contractId: operation.contractId,
              recipient: operation.recipient,
              ...(operation.ownerEmail !== undefined
                ? { ownerEmail: operation.ownerEmail }
                : {}),
              ...(operation.telegramChatId !== undefined
                ? { telegramChatId: operation.telegramChatId }
                : {}),
            })
          : await this.removeUnlocked({
              contractId: operation.contractId,
              recipientHash: operation.recipientHash,
              ...(operation.ownerEmail !== undefined
                ? { ownerEmail: operation.ownerEmail }
                : {}),
              ...(operation.telegramChatId !== undefined
                ? { telegramChatId: operation.telegramChatId }
                : {}),
            });
      await this.writePending(pending.filter((item) => item.operationId !== operationId));
      return result;
    });
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const operation = this.#writeQueue.then(work, work);
    this.#writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async read(contractId: string): Promise<BusinessPayroll | null> {
    assertContractId(contractId);
    try {
      const value = JSON.parse(await readFile(this.filePath(contractId), "utf8")) as unknown;
      return validateBusinessPayroll(
        businessPayrollSchema.parse(value) as BusinessPayroll,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private async upsertUnlocked(options: {
    contractId: string;
    recipient: PayrollRecipient;
    ownerEmail?: string | null;
    telegramChatId?: string | null;
  }): Promise<{ recipientCount: number }> {
    const existing = await this.read(options.contractId);
    const recipients = [...(existing?.recipients ?? [])];
    const index = recipients.findIndex(
      (recipient) => recipient.recipientHash === options.recipient.recipientHash,
    );
    if (index >= 0) recipients[index] = options.recipient;
    else recipients.push(options.recipient);
    const plan = validateBusinessPayroll(
      businessPayrollSchema.parse({
        contract_id: options.contractId,
        owner_email: options.ownerEmail ?? existing?.owner_email ?? DEFAULT_OWNER_EMAIL,
        telegram_chat_id: options.telegramChatId ?? existing?.telegram_chat_id ?? undefined,
        recipients,
      }) as BusinessPayroll,
    );
    await this.write(plan);
    return { recipientCount: plan.recipients.length };
  }

  private async removeUnlocked(options: {
    contractId: string;
    recipientHash: string;
    ownerEmail?: string | null;
    telegramChatId?: string | null;
  }): Promise<{ recipientCount: number; removed: boolean }> {
    assertRecipientHash(options.recipientHash);
    const existing = await this.read(options.contractId);
    const previous = existing?.recipients ?? [];
    const recipients = previous.filter(
      (recipient) => recipient.recipientHash !== options.recipientHash,
    );
    const plan = validateBusinessPayroll(
      businessPayrollSchema.parse({
        contract_id: options.contractId,
        owner_email: options.ownerEmail ?? existing?.owner_email ?? DEFAULT_OWNER_EMAIL,
        telegram_chat_id: options.telegramChatId ?? existing?.telegram_chat_id ?? undefined,
        recipients,
      }) as BusinessPayroll,
    );
    await this.write(plan);
    return {
      recipientCount: plan.recipients.length,
      removed: recipients.length !== previous.length,
    };
  }

  private pendingOperation(operation: PendingPayrollOperationInput): PendingPayrollOperation {
    const createdAt = new Date();
    return {
      ...operation,
      operationId: randomUUID(),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + PENDING_OPERATION_TTL_MS).toISOString(),
    };
  }

  private async readPending(): Promise<PendingPayrollOperation[]> {
    try {
      const value = JSON.parse(
        await readFile(path.join(this.#directory, PENDING_OPERATIONS_FILE), "utf8"),
      ) as unknown;
      if (!Array.isArray(value)) throw new Error("Pending payroll operation file is invalid");
      return value as PendingPayrollOperation[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async writePending(operations: PendingPayrollOperation[]): Promise<void> {
    await mkdir(this.#directory, { recursive: true, mode: 0o700 });
    const targetPath = path.join(this.#directory, PENDING_OPERATIONS_FILE);
    const temporaryPath = path.join(
      this.#directory,
      `.${PENDING_OPERATIONS_FILE}.${randomUUID()}.tmp`,
    );
    try {
      await writeFile(temporaryPath, `${JSON.stringify(operations, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      });
      await rename(temporaryPath, targetPath);
      await chmod(targetPath, 0o600).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOSYS" && error.code !== "EPERM") throw error;
      });
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private async write(plan: BusinessPayroll): Promise<void> {
    await mkdir(this.#directory, { recursive: true, mode: 0o700 });
    const targetPath = this.filePath(plan.contract_id);
    const temporaryPath = path.join(
      this.#directory,
      `.${plan.contract_id}.${randomUUID()}.tmp`,
    );
    try {
      await writeFile(temporaryPath, `${JSON.stringify(plan, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      });
      await rename(temporaryPath, targetPath);
      await chmod(targetPath, 0o600).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOSYS" && error.code !== "EPERM") throw error;
      });
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private filePath(contractId: string): string {
    assertContractId(contractId);
    return path.join(this.#directory, `${contractId}.json`);
  }
}

function assertContractId(contractId: string): void {
  if (
    !nearAccountPattern.test(contractId) ||
    (contractId !== "clavis.testnet" && !contractId.endsWith(".clavis.testnet"))
  ) {
    throw new Error("Invalid payroll contract ID");
  }
}

function assertRecipientHash(recipientHash: string): void {
  if (!/^[a-f0-9]{64}$/.test(recipientHash)) {
    throw new Error("Invalid payroll recipient hash");
  }
}
