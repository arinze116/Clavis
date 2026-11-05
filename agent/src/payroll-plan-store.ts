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
    return this.enqueue(async () => {
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
          telegram_chat_id:
            options.telegramChatId ?? existing?.telegram_chat_id ?? undefined,
          recipients,
        }) as BusinessPayroll,
      );
      await this.write(plan);
      return { recipientCount: plan.recipients.length };
    });
  }

  remove(options: {
    contractId: string;
    recipientHash: string;
    ownerEmail?: string | null;
    telegramChatId?: string | null;
  }): Promise<{ recipientCount: number; removed: boolean }> {
    return this.enqueue(async () => {
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
          telegram_chat_id:
            options.telegramChatId ?? existing?.telegram_chat_id ?? undefined,
          recipients,
        }) as BusinessPayroll,
      );
      await this.write(plan);
      return {
        recipientCount: plan.recipients.length,
        removed: recipients.length !== previous.length,
      };
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
