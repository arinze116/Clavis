export interface FinalTransactionOutcome {
  transaction?: { hash?: string };
  receipts_outcome?: Array<{
    outcome?: {
      executor_id?: string;
      logs?: string[];
    };
  }>;
}

interface PaymentDecisionEvent {
  standard?: unknown;
  event?: unknown;
  data?: unknown;
}

export function paymentDecisionIds(
  outcome: FinalTransactionOutcome,
  targetContractId: string,
): number[] {
  const paymentIds: number[] = [];
  for (const receipt of outcome.receipts_outcome ?? []) {
    if (receipt.outcome?.executor_id !== targetContractId) continue;
    for (const log of receipt.outcome.logs ?? []) {
      if (!log.startsWith("EVENT_JSON:")) continue;
      let event: PaymentDecisionEvent;
      try {
        event = JSON.parse(log.slice("EVENT_JSON:".length)) as PaymentDecisionEvent;
      } catch {
        continue;
      }
      if (event.standard !== "clavis" || event.event !== "payment_decision") continue;
      if (!Array.isArray(event.data)) continue;
      for (const item of event.data) {
        if (typeof item !== "object" || item === null) continue;
        const value = (item as { payment_id?: unknown }).payment_id;
        const paymentId = typeof value === "string" ? Number(value) : value;
        if (
          typeof paymentId === "number" &&
          Number.isSafeInteger(paymentId) &&
          paymentId > 0
        ) {
          paymentIds.push(paymentId);
        }
      }
    }
  }
  return paymentIds;
}

export function mapPaymentDecisionTransactions(
  outcomes: FinalTransactionOutcome[],
  targetContractId: string,
): Map<number, string> {
  const transactions = new Map<number, string>();
  for (const outcome of outcomes) {
    const transactionHash = outcome.transaction?.hash;
    if (!transactionHash) continue;
    for (const paymentId of paymentDecisionIds(outcome, targetContractId)) {
      if (!transactions.has(paymentId)) transactions.set(paymentId, transactionHash);
    }
  }
  return transactions;
}
