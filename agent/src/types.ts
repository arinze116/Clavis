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

export interface RecipientView {
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
}

export interface ContractAnomalyEntry {
  anomaly_id: number;
  timestamp: number;
  anomaly_type: string;
  severity: "MEDIUM" | "HIGH";
  description: string;
  reviewed: boolean;
}

export interface PaymentResult {
  approved: boolean;
  payment_id: number;
  reason: string | null;
  settled: boolean;
  transaction_hash: string;
}

export interface Destination {
  chain: Chain;
  token: Token;
  address: string;
  percentage: number;
}

export interface PayrollRecipient {
  recipientHash: string;
  name: string;
  nearAddress: string;
  amountYocto: string;
  milestoneReady: boolean;
  milestoneId?: string;
  destinations: Destination[];
}

export interface BusinessPayroll {
  contract_id: string;
  owner_email: string;
  telegram_chat_id: string | undefined;
  recipients: PayrollRecipient[];
}

export interface PayrollFile {
  businesses: BusinessPayroll[];
}

export type AnomalyType =
  | "HIGH_FREQUENCY"
  | "OFF_HOURS"
  | "NEAR_DAILY_LIMIT"
  | "RECIPIENT_ROUTE_CHANGED"
  | "POSSIBLE_REPLAY";

export interface Anomaly {
  type: AnomalyType;
  severity: "MEDIUM" | "HIGH";
  description: string;
  timestamp: number;
}

export interface RequestRecord {
  recipientHash: string;
  timestamp: number;
}

export interface PaymentRecord {
  paymentId: number;
  recipientHash: string;
  amountYocto: string;
  approvedAt: number;
  status: "PENDING_DELIVERY" | "DELIVERED" | "DELIVERY_FAILED";
}

export interface AgentState {
  version: 1;
  lastReportDate: string | null;
  routeFingerprints: Record<string, string>;
  completedMilestones: Record<string, string>;
  anomalyNotifications: Record<string, number>;
  requests: RequestRecord[];
  payments: PaymentRecord[];
  pendingIntents: IntentEnvelope[];
}

export interface IntentEnvelope {
  intentId: string;
  contractId: string;
  paymentId: number;
  recipientHash: string;
  recipientName: string;
  nearRecipient: string;
  sourceAsset: "NEAR";
  sourceAmountYocto: string;
  destination: Destination;
  createdAt: string;
}

export type IntentStatus = "PENDING" | "FILLED" | "FAILED";

export interface IntentRecord extends IntentEnvelope {
  status: IntentStatus;
  attempts: number;
  reference?: string;
  transactionHash?: string;
  fallback?: boolean;
  settlementKind?: "solver_intent" | "native_near";
  lastError?: string;
  nextRetryAt?: string;
  updatedAt: string;
}

export interface IntentSubmission {
  intentId: string;
  status: "PENDING" | "FILLED";
  reference: string;
  transactionHash?: string;
  fallback: boolean;
  settlementKind: "solver_intent" | "native_near";
}

export interface DailyReportSummary {
  approvedPayments: number;
  deliveredPayments: number;
  deliveryFailures: number;
  authorizedAmountYocto: string;
}
