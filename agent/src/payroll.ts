import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { BusinessPayroll, PayrollFile, PayrollRecipient } from "./types.js";

export const nearAccountPattern = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
export const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
const maxU128 = (1n << 128n) - 1n;

const destinationSchema = z.object({
  chain: z.enum(["near", "ethereum", "bnb"]),
  token: z.enum(["NEAR", "USDC", "BUSD"]),
  address: z.string().trim().min(2).max(128),
  percentage: z.number().int().min(1).max(100),
});

export const payrollRecipientSchema = z.object({
  recipientHash: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(1).max(80).default("Worker"),
  nearAddress: z.string().trim().regex(nearAccountPattern).optional(),
  amountYocto: z
    .string()
    .regex(/^\d+$/)
    .refine((value) => {
      const amount = BigInt(value);
      return amount > 0n && amount <= maxU128;
    }, "Amount must be a positive u128 yoctoNEAR value"),
  milestoneReady: z.boolean().default(false),
  milestoneId: z.string().trim().min(1).max(80).optional(),
  destinations: z.array(destinationSchema).min(1).max(3),
});

export const businessPayrollSchema = z.object({
  contract_id: z.string().trim().regex(nearAccountPattern),
  owner_email: z.string().email(),
  telegram_chat_id: z.string().trim().min(1).optional(),
  recipients: z.array(payrollRecipientSchema).max(20),
});

const aggregateSchema = z.object({
  businesses: z.array(businessPayrollSchema),
});

const legacySchema = z.object({
  version: z.literal(1).optional(),
  owner_email: z.string().email().optional(),
  telegram_chat_id: z.string().trim().min(1).optional(),
  recipients: z.array(payrollRecipientSchema).max(20),
});

async function readJson(filePath: string): Promise<unknown> {
  let source: string;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read the private payroll file at ${filePath}`, { cause: error });
  }

  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    throw new Error(`The private payroll file at ${filePath} is not valid JSON`, {
      cause: error,
    });
  }
}

export function validateBusinessPayroll(input: BusinessPayroll): BusinessPayroll {
  const seen = new Set<string>();
  const recipients: PayrollRecipient[] = input.recipients.map((recipient) => {
    if (seen.has(recipient.recipientHash)) {
      throw new Error(`${input.contract_id} contains a duplicate recipient hash`);
    }
    seen.add(recipient.recipientHash);

    if (recipient.milestoneReady && !recipient.milestoneId) {
      throw new Error(`${input.contract_id}: a ready milestone must include a milestoneId`);
    }

    const percentage = recipient.destinations.reduce(
      (sum, destination) => sum + destination.percentage,
      0,
    );
    if (percentage !== 100) {
      throw new Error(
        `${input.contract_id}: every recipient's destination percentages must sum to 100`,
      );
    }

    for (const destination of recipient.destinations) {
      const validPair =
        (destination.chain === "near" && destination.token === "NEAR") ||
        (destination.chain === "ethereum" && destination.token === "USDC") ||
        (destination.chain === "bnb" && destination.token === "BUSD");
      if (!validPair) {
        throw new Error(`${input.contract_id} contains an unsupported chain/token pair`);
      }
      const validAddress =
        destination.chain === "near"
          ? nearAccountPattern.test(destination.address)
          : evmAddressPattern.test(destination.address);
      if (!validAddress) {
        throw new Error(
          `${input.contract_id} contains an invalid ${destination.chain} destination address`,
        );
      }
    }

    const nearDestination = recipient.destinations.find(
      (destination) => destination.chain === "near",
    );
    const nearAddress = recipient.nearAddress ?? nearDestination?.address ?? "";
    if (!nearAddress || !nearAccountPattern.test(nearAddress)) {
      throw new Error(
        `${input.contract_id} requires a valid fallback NEAR address for every recipient`,
      );
    }
    return {
      ...recipient,
      nearAddress,
    };
  });

  return { ...input, recipients };
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

export async function loadPayrollCatalog(filePath: string): Promise<PayrollFile> {
  const value = await readJson(filePath);
  const parsed = aggregateSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid multi-business payroll file: ${formatIssues(parsed.error)}`);
  }

  const businesses = parsed.data.businesses.map((business) =>
    validateBusinessPayroll({
      ...business,
      telegram_chat_id: business.telegram_chat_id,
    } as BusinessPayroll),
  );
  const contractIds = new Set<string>();
  for (const business of businesses) {
    if (contractIds.has(business.contract_id)) {
      throw new Error(`Duplicate payroll plan for ${business.contract_id}`);
    }
    contractIds.add(business.contract_id);
  }
  return { businesses };
}

export async function loadBusinessPayroll(options: {
  contractId: string;
  payrollDirectory: string;
  catalog: PayrollFile;
}): Promise<BusinessPayroll | null> {
  const dedicatedPath = path.join(options.payrollDirectory, `${options.contractId}.json`);
  try {
    const value = await readJson(dedicatedPath);
    const direct = businessPayrollSchema.safeParse(value);
    if (direct.success) {
      if (direct.data.contract_id !== options.contractId) {
        throw new Error(
          `Payroll file ${dedicatedPath} names ${direct.data.contract_id}, expected ${options.contractId}`,
        );
      }
      return validateBusinessPayroll(direct.data as BusinessPayroll);
    }

    const legacy = legacySchema.safeParse(value);
    if (!legacy.success) {
      throw new Error(`Invalid payroll file ${dedicatedPath}: ${formatIssues(legacy.error)}`);
    }
    return validateBusinessPayroll({
      contract_id: options.contractId,
      owner_email: legacy.data.owner_email ?? "notifications-disabled@example.com",
      telegram_chat_id: legacy.data.telegram_chat_id,
      recipients: legacy.data.recipients as PayrollRecipient[],
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).cause instanceof Error) {
      const cause = (error as Error & { cause?: NodeJS.ErrnoException }).cause;
      if (cause?.code !== "ENOENT") throw error;
    } else if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return (
    options.catalog.businesses.find(
      (business) => business.contract_id === options.contractId,
    ) ?? null
  );
}
