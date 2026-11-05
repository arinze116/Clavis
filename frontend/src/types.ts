export type Chain = "near" | "ethereum" | "bnb";
export type Token = "NEAR" | "USDC" | "BUSD";
export type PaymentSchedule = "Weekly" | "Biweekly" | "Milestone";

export interface ContractRecord {
  name: string;
  contract_id: string;
  owner: string;
  created_at: number;
}

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

export type SecurityAuditScenario =
  | "UNAPPROVED_RECIPIENT"
  | "OVER_LIMIT_PAYMENT"
  | "SUSPENDED_RECIPIENT"
  | "DAILY_LIMIT_BREACH"
  | "OFF_HOURS_PAYMENT";

export interface SecurityAuditResult {
  scenario: SecurityAuditScenario;
  blocked: boolean;
  reason: string;
  payment_id: number;
}

export interface ContractSnapshot {
  contractId: string;
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
  region?: string;
  personalCapNear: string;
  paymentAmountNear: string;
  destinationAddress: string;
  preferredChain: Chain;
  preferredToken: Token;
  schedule: PaymentSchedule;
}

export interface RecipientUpdateDraft {
  personalCapNear: string;
  walletAddress: string;
  paymentAmountNear: string;
  destinationAddress: string;
  preferredChain: Chain;
  preferredToken: Token;
  schedule: PaymentSchedule;
  active: boolean;
  updatePrivatePlan: boolean;
}

export interface WorkerPreferences {
  displayName: string;
  preferredChain: Chain;
  preferredToken: Token;
  walletAddress: string;
  paymentSplit: SplitConfig[];
}
