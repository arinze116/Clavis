mod audit;
mod payments;
mod recipients;
mod rules;
mod treasury;
mod types;

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::json_types::U128;
use near_sdk::{env, near_bindgen, AccountId, BorshStorageKey, PanicOnDefault};

use crate::types::RecipientConfig;
pub use crate::types::{
    AnomalyEntry, AuditEntry, PaymentOutcome, PaymentResult, PaymentSchedule, RecipientConfigInput,
    RecipientView, SplitConfig,
};

pub(crate) const DAY_NS: u64 = 86_400_000_000_000;
pub(crate) const HOUR_NS: u64 = 3_600_000_000_000;
pub(crate) const MINUTE_NS: u64 = 60_000_000_000;
pub(crate) const ANOMALY_COOLDOWN_NS: u64 = 5 * MINUTE_NS;
pub(crate) const MAX_RECIPIENTS: u64 = 20;
pub(crate) const MAX_PAGE_SIZE: u64 = 100;

#[derive(BorshSerialize, BorshStorageKey)]
pub(crate) enum StorageKey {
    Recipients,
    AuditLog,
    AnomalyLog,
    RecipientLastRequest,
    AnomalyLastLogged,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Clavis {
    pub(crate) owner: AccountId,
    pub(crate) agent: AccountId,
    pub(crate) daily_limit: u128,
    pub(crate) per_payment_limit: u128,
    pub(crate) daily_spent: u128,
    pub(crate) last_reset_timestamp: u64,
    pub(crate) recipients: UnorderedMap<String, RecipientConfig>,
    pub(crate) recipient_count: u64,
    pub(crate) audit_log: Vector<AuditEntry>,
    pub(crate) log_counter: u64,
    pub(crate) anomaly_log: Vector<AnomalyEntry>,
    pub(crate) anomaly_counter: u64,
    pub(crate) recipient_last_request: LookupMap<String, u64>,
    pub(crate) anomaly_last_logged: LookupMap<String, u64>,
    pub(crate) paused: bool,
}

#[near_bindgen]
impl Clavis {
    #[init]
    pub fn new(
        owner: AccountId,
        agent: AccountId,
        daily_limit: U128,
        per_payment_limit: U128,
    ) -> Self {
        assert!(!env::state_exists(), "Contract is already initialized");
        assert!(daily_limit.0 > 0, "Daily limit must be greater than zero");
        assert!(
            per_payment_limit.0 > 0,
            "Per-payment limit must be greater than zero"
        );
        assert!(
            per_payment_limit.0 <= daily_limit.0,
            "Per-payment limit cannot exceed daily limit"
        );

        Self {
            owner,
            agent,
            daily_limit: daily_limit.0,
            per_payment_limit: per_payment_limit.0,
            daily_spent: 0,
            last_reset_timestamp: env::block_timestamp(),
            recipients: UnorderedMap::new(StorageKey::Recipients),
            recipient_count: 0,
            audit_log: Vector::new(StorageKey::AuditLog),
            log_counter: 0,
            anomaly_log: Vector::new(StorageKey::AnomalyLog),
            anomaly_counter: 0,
            recipient_last_request: LookupMap::new(StorageKey::RecipientLastRequest),
            anomaly_last_logged: LookupMap::new(StorageKey::AnomalyLastLogged),
            paused: false,
        }
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    pub fn get_agent(&self) -> AccountId {
        self.agent.clone()
    }

    pub fn contract_version(&self) -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}

impl Clavis {
    pub(crate) fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "Owner authorization required"
        );
    }
}

#[cfg(test)]
mod tests;
