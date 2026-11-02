export type Chain = "near" | "ethereum" | "bnb";
export type Token = "NEAR" | "USDC" | "BUSD";
export type PaymentSchedule = "Weekly" | "Biweekly" | "Milestone";

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

export interface PaymentResult {
  approved: boolean;
  payment_id: number;
  reason: string | null;
}

export interface Destination {
  chain: Chain;
  token: Token;
  address: string;
  percentage: number;
}

export interface PayrollRecipient {
  recipientHash: string;
  amountYocto: string;
  milestoneReady: boolean;
  milestoneId?: string;
  destinations: Destination[];
}

export interface PayrollFile {
  version: 1;
  recipients: PayrollRecipient[];
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
  requests: RequestRecord[];
  payments: PaymentRecord[];
  pendingIntents: IntentEnvelope[];
}

export interface IntentEnvelope {
  intentId: string;
  paymentId: number;
  recipientHash: string;
  sourceAsset: "NEAR";
  sourceAmountYocto: string;
  destination: Destination;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface IntentSubmission {
  intentId: string;
  status: "SIMULATED" | "SUBMITTED";
  reference: string;
}
