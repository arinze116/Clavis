use near_sdk::json_types::U64;
use near_sdk::{
    env, near_bindgen, AccountId, Gas, NearToken, Promise, PromiseOrValue, PromiseResult,
};

use crate::types::{PaymentOutcome, PaymentResult, PendingNativePayment, RuleResult};
use crate::{Clavis, ClavisExt, HOUR_NS, MINUTE_NS};

const NATIVE_SETTLEMENT_CALLBACK_GAS: Gas = Gas::from_tgas(30);
const NATIVE_SETTLEMENT_CALLBACK_STORAGE_BUFFER_BYTES: u64 = 8 * 1024;
pub(crate) const PENDING_NATIVE_PAYMENT_RECOVERY_DELAY_NS: u64 = 10 * MINUTE_NS;

impl Clavis {
    fn rejected_payment(payment_id: u64, reason: String) -> PaymentResult {
        PaymentResult {
            approved: false,
            payment_id,
            reason: Some(reason),
            settled: false,
        }
    }

    fn recipient_account_hash(account_id: &AccountId) -> String {
        env::sha256(account_id.as_str().as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    fn rollback_pending_native_payment(&mut self, pending: &PendingNativePayment) {
        self.daily_spent = self.daily_spent.saturating_sub(pending.amount);
        if let Some(mut recipient) = self.recipients.get(&pending.recipient_hash) {
            if recipient.last_paid == pending.reserved_at {
                recipient.last_paid = pending.previous_last_paid;
                self.recipients.insert(&pending.recipient_hash, &recipient);
            }
        }
    }

    fn finalize_native_payment(&mut self, delivered: bool, failure_reason: &str) -> PaymentResult {
        let pending = self
            .pending_native_payment
            .take()
            .expect("No native payment is pending");
        if delivered {
            let payment_id = self.append_audit(PaymentOutcome::Approved);
            self.inspect_treasury_threshold();
            return PaymentResult {
                approved: true,
                payment_id,
                reason: None,
                settled: true,
            };
        }

        self.rollback_pending_native_payment(&pending);
        let reason = failure_reason.to_string();
        let payment_id = self.append_audit(PaymentOutcome::Rejected(reason.clone()));
        Self::rejected_payment(payment_id, reason)
    }

    fn valid_transaction_hash(value: &str) -> bool {
        (32..=64).contains(&value.len())
            && value.bytes().all(|byte| {
                matches!(
                    byte,
                    b'1'..=b'9'
                        | b'A'..=b'H'
                        | b'J'..=b'N'
                        | b'P'..=b'Z'
                        | b'a'..=b'k'
                        | b'm'..=b'z'
                )
            })
    }

    pub(crate) fn is_off_hours_at(timestamp: u64) -> bool {
        let utc_hour = (timestamp / HOUR_NS) % 24;
        utc_hour < 6
    }

    pub(crate) fn is_registered_route(
        recipient: &crate::types::RecipientConfig,
        chain: &str,
        token: &str,
    ) -> bool {
        if recipient.payment_split.is_empty() {
            return recipient.preferred_chain == chain && recipient.preferred_token == token;
        }

        recipient
            .payment_split
            .iter()
            .any(|split| split.chain == chain && split.token == token)
    }

    pub(crate) fn is_schedule_due_at(
        recipient: &crate::types::RecipientConfig,
        timestamp: u64,
    ) -> bool {
        if recipient.last_paid == 0 {
            return true;
        }

        let interval = match recipient.schedule {
            crate::types::PaymentSchedule::Weekly => 7 * crate::DAY_NS,
            crate::types::PaymentSchedule::Biweekly => 14 * crate::DAY_NS,
            crate::types::PaymentSchedule::Milestone => return true,
        };

        timestamp.saturating_sub(recipient.last_paid) >= interval
    }

    pub(crate) fn next_payment_at(recipient: &crate::types::RecipientConfig) -> Option<u64> {
        if recipient.last_paid == 0 {
            return Some(env::block_timestamp());
        }

        match recipient.schedule {
            crate::types::PaymentSchedule::Weekly => {
                Some(recipient.last_paid.saturating_add(7 * crate::DAY_NS))
            }
            crate::types::PaymentSchedule::Biweekly => {
                Some(recipient.last_paid.saturating_add(14 * crate::DAY_NS))
            }
            crate::types::PaymentSchedule::Milestone => None,
        }
    }

    fn inspect_request_anomalies(&mut self, recipient_hash: &String) {
        let now = env::block_timestamp();
        let mut recent_requests = 1_u64;

        for index in (0..self.audit_log.len()).rev() {
            let Some(entry) = self.audit_log.get(index) else {
                continue;
            };
            if now.saturating_sub(entry.timestamp) > HOUR_NS {
                break;
            }
            if matches!(
                &entry.outcome,
                PaymentOutcome::Rejected(reason) if reason.starts_with("Security audit:")
            ) {
                continue;
            }
            recent_requests += 1;
        }

        if recent_requests > 10 {
            self.append_anomaly(
                "HIGH_FREQUENCY",
                "HIGH",
                format!("{recent_requests} payment requests in the last hour"),
            );
        }

        if Self::is_off_hours_at(now) {
            self.append_anomaly(
                "OFF_HOURS",
                "MEDIUM",
                "Payment activity between 00:00 and 06:00 UTC".to_string(),
            );
        }

        // Only keep per-recipient request state for existing commitments. A
        // compromised key cannot grow contract storage with arbitrary hashes.
        if self.recipients.get(recipient_hash).is_some() {
            if let Some(previous) = self.recipient_last_request.get(recipient_hash) {
                if now.saturating_sub(previous) < MINUTE_NS {
                    self.append_anomaly(
                        "POSSIBLE_REPLAY",
                        "HIGH",
                        "The same recipient was requested twice within one minute".to_string(),
                    );
                }
            }
            self.recipient_last_request.insert(recipient_hash, &now);
        }
    }

    fn inspect_treasury_threshold(&mut self) {
        if self.daily_limit > 0
            && self.daily_spent.saturating_mul(100) >= self.daily_limit.saturating_mul(90)
        {
            let percentage = self.daily_spent.saturating_mul(100) / self.daily_limit;
            self.append_anomaly(
                "NEAR_DAILY_LIMIT",
                "MEDIUM",
                format!("{percentage}% of the daily authorization limit is used"),
            );
        }
    }
}

#[near_bindgen]
impl Clavis {
    /// Evaluates policy and, for native NEAR, transfers from the contract
    /// treasury before recording approval. The minimized audit entry omits the
    /// amount and recipient, but standard NEAR transaction arguments remain
    /// public. Cross-chain execution fails closed in this release.
    pub fn request_payment(
        &mut self,
        recipient_hash: String,
        amount: near_sdk::json_types::U128,
        chain: String,
        token: String,
        recipient_account_id: Option<AccountId>,
    ) -> PromiseOrValue<PaymentResult> {
        // Do not write an audit entry or anomaly state for arbitrary public
        // callers. This prevents a storage-exhaustion attack against the
        // contract account while still returning a deterministic rejection.
        if env::predecessor_account_id() != self.agent {
            return PromiseOrValue::Value(Self::rejected_payment(
                0,
                "Unauthorized caller".to_string(),
            ));
        }
        if self.pending_native_payment.is_some() {
            return PromiseOrValue::Value(Self::rejected_payment(
                0,
                "A native payment transfer is already pending".to_string(),
            ));
        }

        let valid_hash = recipient_hash.len() == 64
            && recipient_hash
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte));
        if !valid_hash {
            let reason = "Invalid recipient hash".to_string();
            let payment_id = self.append_audit(PaymentOutcome::Rejected(reason.clone()));
            return PromiseOrValue::Value(Self::rejected_payment(payment_id, reason));
        }

        self.inspect_request_anomalies(&recipient_hash);

        match self.enforce_rules(&recipient_hash, amount.0, &chain, &token) {
            RuleResult::Rejected(reason) => {
                let payment_id = self.append_audit(PaymentOutcome::Rejected(reason.clone()));
                PromiseOrValue::Value(Self::rejected_payment(payment_id, reason))
            }
            RuleResult::Approved(mut recipient) => {
                if chain != "near" || token != "NEAR" {
                    let reason =
                        "Cross-chain settlement is not contract-controlled in this release"
                            .to_string();
                    let payment_id = self.append_audit(PaymentOutcome::Rejected(reason.clone()));
                    return PromiseOrValue::Value(Self::rejected_payment(payment_id, reason));
                }
                let Some(recipient_account_id) = recipient_account_id else {
                    let reason = "Native NEAR recipient account is required".to_string();
                    let payment_id = self.append_audit(PaymentOutcome::Rejected(reason.clone()));
                    return PromiseOrValue::Value(Self::rejected_payment(payment_id, reason));
                };
                if Self::recipient_account_hash(&recipient_account_id) != recipient_hash {
                    let reason =
                        "Native NEAR recipient does not match the approved commitment".to_string();
                    let payment_id = self.append_audit(PaymentOutcome::Rejected(reason.clone()));
                    return PromiseOrValue::Value(Self::rejected_payment(payment_id, reason));
                }
                // Leave enough balance for the account's existing storage, a
                // bounded callback write buffer, and an operational reserve.
                // This keeps a successful transfer from starving the callback
                // that records approval and clears the pending settlement.
                let reserve =
                    Self::operational_reserve(NATIVE_SETTLEMENT_CALLBACK_STORAGE_BUFFER_BYTES);
                let available = env::account_balance().saturating_sub(reserve);
                if available.as_yoctonear() < amount.0 {
                    let reason = "Insufficient contract treasury balance".to_string();
                    let payment_id = self.append_audit(PaymentOutcome::Rejected(reason.clone()));
                    return PromiseOrValue::Value(Self::rejected_payment(payment_id, reason));
                }

                let reserved_at = env::block_timestamp();
                let previous_last_paid = recipient.last_paid;
                self.daily_spent = self
                    .daily_spent
                    .checked_add(amount.0)
                    .expect("Daily spend overflow was checked by the rules engine");
                recipient.last_paid = reserved_at;
                self.recipients.insert(&recipient_hash, &recipient);
                self.pending_native_payment = Some(PendingNativePayment {
                    recipient_hash,
                    recipient_account_id: recipient_account_id.clone(),
                    amount: amount.0,
                    reserved_at,
                    previous_last_paid,
                });

                PromiseOrValue::Promise(
                    Promise::new(recipient_account_id)
                        .transfer(NearToken::from_yoctonear(amount.0))
                        .then(Promise::new(env::current_account_id()).function_call(
                            "on_native_payment_settled".to_string(),
                            b"{}".to_vec(),
                            NearToken::from_yoctonear(0),
                            NATIVE_SETTLEMENT_CALLBACK_GAS,
                        )),
                )
            }
        }
    }

    #[private]
    pub fn on_native_payment_settled(&mut self) -> PaymentResult {
        self.finalize_native_payment(
            matches!(env::promise_result(0), PromiseResult::Successful(_)),
            "Native NEAR transfer failed",
        )
    }

    /// Resolves the rare case where the transfer callback itself never
    /// completes. The owner must wait for finality, inspect the referenced
    /// Testnet transaction, and attest whether the transfer was delivered.
    pub fn resolve_stale_native_payment(
        &mut self,
        delivered: bool,
        evidence_transaction_hash: String,
    ) -> PaymentResult {
        self.assert_owner();
        assert!(
            Self::valid_transaction_hash(&evidence_transaction_hash),
            "A valid NEAR transaction hash is required"
        );
        let pending = self
            .pending_native_payment
            .as_ref()
            .expect("No native payment is pending");
        assert!(
            env::block_timestamp().saturating_sub(pending.reserved_at)
                >= PENDING_NATIVE_PAYMENT_RECOVERY_DELAY_NS,
            "Pending payment is not yet recoverable"
        );

        let result = self.finalize_native_payment(
            delivered,
            "Native NEAR transfer failed; owner resolved a stale callback",
        );
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({
                "standard": "clavis",
                "version": "1.0.0",
                "event": "payment_recovery",
                "data": [{
                    "payment_id": result.payment_id,
                    "delivered": delivered,
                    "evidence_transaction_hash": evidence_transaction_hash,
                }],
            })
        ));
        result
    }

    pub fn get_pending_native_payment_recovery_at(&self) -> Option<U64> {
        self.pending_native_payment.as_ref().map(|pending| {
            U64(pending
                .reserved_at
                .saturating_add(PENDING_NATIVE_PAYMENT_RECOVERY_DELAY_NS))
        })
    }
}
