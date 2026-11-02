const YOCTO = 10n ** 24n;

export function nearToYocto(value: string): string {
  const normalized = value.trim();
  if (!/^\d+(\.\d{0,24})?$/.test(normalized)) {
    throw new Error("Enter a valid NEAR amount with at most 24 decimal places");
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  return (BigInt(whole) * YOCTO + BigInt(fraction.padEnd(24, "0") || "0")).toString();
}

export function formatNear(yocto: string, maximumFractionDigits = 2): string {
  try {
    const value = BigInt(yocto);
    const whole = value / YOCTO;
    const remainder = value % YOCTO;
    if (maximumFractionDigits === 0 || remainder === 0n) {
      return `${whole.toLocaleString()} NEAR`;
    }
    const fraction = remainder
      .toString()
      .padStart(24, "0")
      .slice(0, maximumFractionDigits)
      .replace(/0+$/, "");
    return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""} NEAR`;
  } catch {
    return "—";
  }
}

export function timestampToDate(timestamp: number | string): Date {
  try {
    const milliseconds = BigInt(String(timestamp)) / 1_000_000n;
    return new Date(Number(milliseconds));
  } catch {
    return new Date(0);
  }
}

export function formatTimestamp(timestamp: number | string): string {
  const date = timestampToDate(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function outcomeDetails(outcome: import("../types").PaymentOutcome): {
  approved: boolean;
  reason: string | null;
} {
  return outcome === "Approved"
    ? { approved: true, reason: null }
    : { approved: false, reason: outcome.Rejected };
}

export function maskAccount(accountId: string): string {
  if (accountId.length <= 22) return accountId;
  return `${accountId.slice(0, 10)}…${accountId.slice(-8)}`;
}

export function chainLabel(chain: import("../types").Chain): string {
  return { near: "NEAR", ethereum: "Ethereum", bnb: "BNB Chain" }[chain];
}
