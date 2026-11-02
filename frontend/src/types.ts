export type Chain = "near" | "ethereum" | "bnb";
export type Token = "NEAR" | "USDC" | "BUSD";
export type PaymentSchedule = "Weekly" | "Biweekly" | "Milestone";

export interface SplitConfig {
  chain: Chain;
  token: Token;
  percentage: number;
}

export interface Recipient {
  recipient_hash: string;
  name: string;
  personal_cap: string;
  active: boolean;
  preferred_chain: Chain;
  preferred_token: Token;
  payment_split: SplitConfig[];
  schedule: PaymentSchedule;
  last_paid: number;
  next_payment_at: number | null;
}

export type PaymentOutcome = "Approved" | { Rejected: string };

export interface AuditEntry {
  payment_id: number;
  timestamp: number;
  outcome: PaymentOutcome;
  block_height: number;
  transaction_id?: string;
  transaction_hash?: string;
  tx_hash?: string;
}

export interface AnomalyEntry {
  anomaly_id: number;
  timestamp: number;
  anomaly_type: string;
  severity: "MEDIUM" | "HIGH";
  description: string;
  reviewed: boolean;
}

export interface ContractSnapshot {
  owner: string;
  agent: string;
  dailyLimit: string;
  dailySpent: string;
  perPaymentLimit: string;
  treasuryBalance: string;
  paused: boolean;
  recipients: Recipient[];
  auditLog: AuditEntry[];
  anomalies: AnomalyEntry[];
  logCount: number;
}

export interface RecipientDraft {
  name: string;
  walletAddress: string;
  personalCapNear: string;
  preferredChain: Chain;
  preferredToken: Token;
  schedule: PaymentSchedule;
}
