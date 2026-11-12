mod audit;
mod payments;
mod recipients;
mod rules;
mod security;
mod treasury;
mod types;

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::{
    env, near_bindgen, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue, PromiseResult,
};

use crate::types::PendingNativePayment;
use crate::types::RecipientConfig;
pub use crate::types::{
    AnomalyEntry, AuditEntry, PaymentOutcome, PaymentResult, PaymentSchedule, RecipientConfigInput,
    RecipientView, SecurityAuditResult, SecurityAuditScenario, SplitConfig,
};

pub(crate) const DAY_NS: u64 = 86_400_000_000_000;
pub(crate) const HOUR_NS: u64 = 3_600_000_000_000;
pub(crate) const MINUTE_NS: u64 = 60_000_000_000;
pub(crate) const ANOMALY_COOLDOWN_NS: u64 = 5 * MINUTE_NS;
pub(crate) const MAX_RECIPIENTS: u64 = 20;
pub(crate) const MAX_PAGE_SIZE: u64 = 100;
const FACTORY_ACCOUNT: &str = "factory.clavis.testnet";
const MIN_CHILD_BALANCE: NearToken = NearToken::from_near(6);
const CHILD_INIT_GAS: Gas = Gas::from_tgas(30);
const PROVISION_CALLBACK_GAS: Gas = Gas::from_tgas(15);
const REFUND_CALLBACK_GAS: Gas = Gas::from_tgas(5);

#[derive(BorshSerialize, BorshStorageKey)]
pub(crate) enum StorageKey {
    Recipients,
    AuditLog,
    AnomalyLog,
    RecipientLastRequest,
    AnomalyLastLogged,
    CompletedPaymentReferences,
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
    pub(crate) pending_native_payment: Option<PendingNativePayment>,
    pub(crate) completed_payment_references: LookupMap<String, bool>,
}

#[derive(BorshDeserialize, BorshSerialize)]
struct LegacyClavisV1 {
    owner: AccountId,
    agent: AccountId,
    daily_limit: u128,
    per_payment_limit: u128,
    daily_spent: u128,
    last_reset_timestamp: u64,
    recipients: UnorderedMap<String, RecipientConfig>,
    recipient_count: u64,
    audit_log: Vector<AuditEntry>,
    log_counter: u64,
    anomaly_log: Vector<AnomalyEntry>,
    anomaly_counter: u64,
    recipient_last_request: LookupMap<String, u64>,
    anomaly_last_logged: LookupMap<String, u64>,
    paused: bool,
}

#[derive(BorshDeserialize, BorshSerialize)]
struct LegacyPendingNativePaymentV2 {
    recipient_hash: String,
    recipient_account_id: AccountId,
    amount: u128,
    reserved_at: u64,
    previous_last_paid: u64,
}

#[derive(BorshDeserialize, BorshSerialize)]
struct LegacyClavisV2 {
    owner: AccountId,
    agent: AccountId,
    daily_limit: u128,
    per_payment_limit: u128,
    daily_spent: u128,
    last_reset_timestamp: u64,
    recipients: UnorderedMap<String, RecipientConfig>,
    recipient_count: u64,
    audit_log: Vector<AuditEntry>,
    log_counter: u64,
    anomaly_log: Vector<AnomalyEntry>,
    anomaly_counter: u64,
    recipient_last_request: LookupMap<String, u64>,
    anomaly_last_logged: LookupMap<String, u64>,
    paused: bool,
    pending_native_payment: Option<LegacyPendingNativePaymentV2>,
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
            pending_native_payment: None,
            completed_payment_references: LookupMap::new(StorageKey::CompletedPaymentReferences),
        }
    }

    #[init(ignore_state)]
    pub fn migrate() -> Self {
        let state = env::storage_read(b"STATE").expect("Legacy contract state is required");
        if let Ok(legacy) = LegacyClavisV2::try_from_slice(&state) {
            assert_eq!(
                env::predecessor_account_id(),
                legacy.owner,
                "Owner authorization required"
            );
            return Self {
                owner: legacy.owner,
                agent: legacy.agent,
                daily_limit: legacy.daily_limit,
                per_payment_limit: legacy.per_payment_limit,
                daily_spent: legacy.daily_spent,
                last_reset_timestamp: legacy.last_reset_timestamp,
                recipients: legacy.recipients,
                recipient_count: legacy.recipient_count,
                audit_log: legacy.audit_log,
                log_counter: legacy.log_counter,
                anomaly_log: legacy.anomaly_log,
                anomaly_counter: legacy.anomaly_counter,
                recipient_last_request: legacy.recipient_last_request,
                anomaly_last_logged: legacy.anomaly_last_logged,
                paused: legacy.paused,
                pending_native_payment: legacy.pending_native_payment.map(|pending| {
                    PendingNativePayment {
                        recipient_hash: pending.recipient_hash,
                        recipient_account_id: pending.recipient_account_id,
                        amount: pending.amount,
                        reserved_at: pending.reserved_at,
                        previous_last_paid: pending.previous_last_paid,
                        payment_reference: None,
                    }
                }),
                completed_payment_references: LookupMap::new(
                    StorageKey::CompletedPaymentReferences,
                ),
            };
        }

        let legacy =
            LegacyClavisV1::try_from_slice(&state).expect("Unsupported legacy contract state");
        assert_eq!(
            env::predecessor_account_id(),
            legacy.owner,
            "Owner authorization required"
        );
        Self {
            owner: legacy.owner,
            agent: legacy.agent,
            daily_limit: legacy.daily_limit,
            per_payment_limit: legacy.per_payment_limit,
            daily_spent: legacy.daily_spent,
            last_reset_timestamp: legacy.last_reset_timestamp,
            recipients: legacy.recipients,
            recipient_count: legacy.recipient_count,
            audit_log: legacy.audit_log,
            log_counter: legacy.log_counter,
            anomaly_log: legacy.anomaly_log,
            anomaly_counter: legacy.anomaly_counter,
            recipient_last_request: legacy.recipient_last_request,
            anomaly_last_logged: legacy.anomaly_last_logged,
            paused: legacy.paused,
            pending_native_payment: None,
            completed_payment_references: LookupMap::new(StorageKey::CompletedPaymentReferences),
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

    /// Parent-account provisioner used by factory.clavis.testnet. A factory
    /// contract cannot create sibling accounts directly on NEAR, so the root
    /// account performs the create/deploy/init promise and reports completion.
    #[payable]
    pub fn provision_payroll(
        &mut self,
        contract_id: AccountId,
        owner: AccountId,
        agent: AccountId,
        daily_limit: U128,
        per_payment_limit: U128,
        code: Base64VecU8,
    ) -> Promise {
        assert_eq!(
            env::current_account_id().as_str(),
            "clavis.testnet",
            "Provisioning is only available on the Clavis root account"
        );
        assert_eq!(
            env::predecessor_account_id().as_str(),
            FACTORY_ACCOUNT,
            "Only the Clavis factory can provision payroll contracts"
        );
        assert!(
            env::attached_deposit() >= MIN_CHILD_BALANCE,
            "Insufficient child account balance"
        );
        assert!(!code.0.is_empty(), "Payroll contract code is required");
        let suffix = format!(".{}", env::current_account_id());
        let label = contract_id
            .as_str()
            .strip_suffix(&suffix)
            .expect("Payroll account must be a child of clavis.testnet");
        assert!(
            !label.is_empty() && !label.contains('.'),
            "Payroll account must be a direct child"
        );

        let refund_to = env::predecessor_account_id();
        let amount = env::attached_deposit();
        let init_args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "owner": owner,
            "agent": agent,
            "daily_limit": daily_limit,
            "per_payment_limit": per_payment_limit,
        }))
        .expect("Initialization arguments serialize");

        Promise::new(contract_id)
            .create_account()
            .transfer(amount)
            .deploy_contract(code.0)
            .function_call(
                "new".to_string(),
                init_args,
                NearToken::from_yoctonear(0),
                CHILD_INIT_GAS,
            )
            .then(
                Promise::new(env::current_account_id()).function_call(
                    "on_payroll_provisioned".to_string(),
                    near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
                        "refund_to": refund_to,
                        "amount": U128(amount.as_yoctonear()),
                    }))
                    .expect("Provision callback arguments serialize"),
                    NearToken::from_yoctonear(0),
                    PROVISION_CALLBACK_GAS,
                ),
            )
    }

    #[private]
    pub fn on_payroll_provisioned(
        &self,
        refund_to: AccountId,
        amount: U128,
    ) -> PromiseOrValue<bool> {
        if matches!(env::promise_result(0), PromiseResult::Successful(_)) {
            return PromiseOrValue::Value(true);
        }

        PromiseOrValue::Promise(
            Promise::new(refund_to)
                .transfer(NearToken::from_yoctonear(amount.0))
                .then(Promise::new(env::current_account_id()).function_call(
                    "on_provision_refund_complete".to_string(),
                    b"{}".to_vec(),
                    NearToken::from_yoctonear(0),
                    REFUND_CALLBACK_GAS,
                )),
        )
    }

    #[private]
    pub fn on_provision_refund_complete(&self) -> bool {
        false
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
