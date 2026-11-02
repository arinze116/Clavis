import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { PayrollFile } from "./types.js";

const destinationSchema = z.object({
  chain: z.enum(["near", "ethereum", "bnb"]),
  token: z.enum(["NEAR", "USDC", "BUSD"]),
  address: z.string().min(2).max(128),
  percentage: z.number().int().min(1).max(100),
});

const payrollSchema = z.object({
  version: z.literal(1),
  recipients: z
    .array(
      z.object({
        recipientHash: z.string().regex(/^[a-f0-9]{64}$/),
        amountYocto: z.string().regex(/^\d+$/).refine((value) => BigInt(value) > 0n),
        milestoneReady: z.boolean().default(false),
        milestoneId: z.string().trim().min(1).max(80).optional(),
        destinations: z.array(destinationSchema).min(1).max(3),
      }),
    )
    .max(20),
});

export async function loadPayroll(path: string): Promise<PayrollFile> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Unable to read the private payroll file at ${path}`, { cause: error });
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error("The private payroll file is not valid JSON", { cause: error });
  }

  const parsed = payrollSchema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid private payroll file: ${details}`);
  }

  const seen = new Set<string>();
  for (const recipient of parsed.data.recipients) {
    if (seen.has(recipient.recipientHash)) {
      throw new Error("The private payroll file contains a duplicate recipient hash");
    }
    seen.add(recipient.recipientHash);

    if (recipient.milestoneReady && !recipient.milestoneId) {
      throw new Error("A ready milestone must include a stable milestoneId");
    }

    const percentage = recipient.destinations.reduce(
      (sum, destination) => sum + destination.percentage,
      0,
    );
    if (percentage !== 100) {
      throw new Error("Every recipient's destination percentages must sum to 100");
    }

    for (const destination of recipient.destinations) {
      const validPair =
        (destination.chain === "near" && destination.token === "NEAR") ||
        (destination.chain === "ethereum" && destination.token === "USDC") ||
        (destination.chain === "bnb" && destination.token === "BUSD");
      if (!validPair) {
        throw new Error("The private payroll file contains an unsupported chain/token pair");
      }
    }
  }

  return parsed.data as PayrollFile;
}
