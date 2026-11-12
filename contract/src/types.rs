use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::AccountId;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct SplitConfig {
    pub chain: String,
    pub token: String,
    pub percentage: u8,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub enum PaymentSchedule {
    Weekly,
    Biweekly,
    Milestone,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, PartialEq, Eq)]
pub struct RecipientConfig {
    pub name: String,
    pub personal_cap: u128,
    pub active: bool,
    pub preferred_chain: String,
    pub preferred_token: String,
    pub payment_split: Vec<SplitConfig>,
    pub schedule: PaymentSchedule,
    pub last_paid: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct RecipientConfigInput {
    pub name: String,
    pub personal_cap: U128,
    pub active: bool,
    pub preferred_chain: String,
    pub preferred_token: String,
    #[serde(default)]
    pub payment_split: Vec<SplitConfig>,
    pub schedule: PaymentSchedule,
}

impl From<RecipientConfigInput> for RecipientConfig {
    fn from(value: RecipientConfigInput) -> Self {
        Self {
            name: value.name,
            personal_cap: value.personal_cap.0,
            active: value.active,
            preferred_chain: value.preferred_chain,
            preferred_token: value.preferred_token,
            payment_split: value.payment_split,
            schedule: value.schedule,
            last_paid: 0,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct RecipientView {
    pub recipient_hash: String,
    pub name: String,
    pub personal_cap: U128,
    pub active: bool,
    pub preferred_chain: String,
    pub preferred_token: String,
    pub payment_split: Vec<SplitConfig>,
    pub schedule: PaymentSchedule,
    pub last_paid: u64,
    pub next_payment_at: Option<u64>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub enum PaymentOutcome {
    Approved,
    Rejected(String),
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct AuditEntry {
    pub payment_id: u64,
    pub timestamp: u64,
    pub outcome: PaymentOutcome,
    pub block_height: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct PaymentResult {
    pub approved: bool,
    pub payment_id: u64,
    pub reason: Option<String>,
    pub settled: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, PartialEq, Eq)]
pub(crate) struct PendingNativePayment {
    pub recipient_hash: String,
    pub recipient_account_id: AccountId,
    pub amount: u128,
    pub reserved_at: u64,
    pub previous_last_paid: u64,
    pub payment_reference: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SecurityAuditScenario {
    UnapprovedRecipient,
    OverLimitPayment,
    SuspendedRecipient,
    DailyLimitBreach,
    OffHoursPayment,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct SecurityAuditResult {
    pub scenario: SecurityAuditScenario,
    pub blocked: bool,
    pub reason: String,
    pub payment_id: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct AnomalyEntry {
    pub anomaly_id: u64,
    pub timestamp: u64,
    pub anomaly_type: String,
    pub severity: String,
    pub description: String,
    pub reviewed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum RuleResult {
    Approved(RecipientConfig),
    Rejected(String),
}
