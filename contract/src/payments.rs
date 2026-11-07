use near_sdk::env;

use crate::types::{PaymentOutcome, PaymentResult, RuleResult};
use crate::{Clavis, ClavisExt, HOUR_NS, MINUTE_NS};

impl Clavis {
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

#[near_sdk::near_bindgen]
impl Clavis {
    /// Authorizes a payment without exposing its amount or recipient in the
    /// public audit record. Transaction arguments remain public on standard
    /// NEAR; production confidentiality is supplied by the confidential
    /// executor adapter documented in `docs/PRIVACY.md`.
    pub fn request_payment(
        &mut self,
        recipient_hash: String,
        amount: near_sdk::json_types::U128,
        chain: String,
        token: String,
    ) -> PaymentResult {
        // Do not write an audit entry or anomaly state for arbitrary public
        // callers. This prevents a storage-exhaustion attack against the
        // contract account while still returning a deterministic rejection.
        if env::predecessor_account_id() != self.agent {
            return PaymentResult {
                approved: false,
                payment_id: 0,
                reason: Some("Unauthorized caller".to_string()),
            };
        }

        let valid_hash = recipient_hash.len() == 64
            && recipient_hash
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte));
        if !valid_hash {
            let reason = "Invalid recipient hash".to_string();
            let payment_id = self.append_audit(PaymentOutcome::Rejected(reason.clone()));
            return PaymentResult {
                approved: false,
                payment_id,
                reason: Some(reason),
            };
        }

        self.inspect_request_anomalies(&recipient_hash);

        match self.enforce_rules(&recipient_hash, amount.0, &chain, &token) {
            RuleResult::Rejected(reason) => {
                let payment_id = self.append_audit(PaymentOutcome::Rejected(reason.clone()));
                PaymentResult {
                    approved: false,
                    payment_id,
                    reason: Some(reason),
                }
            }
            RuleResult::Approved(mut recipient) => {
                self.daily_spent = self
                    .daily_spent
                    .checked_add(amount.0)
                    .expect("Daily spend overflow was checked by the rules engine");
                recipient.last_paid = env::block_timestamp();
                self.recipients.insert(&recipient_hash, &recipient);

                let payment_id = self.append_audit(PaymentOutcome::Approved);
                self.inspect_treasury_threshold();

                PaymentResult {
                    approved: true,
                    payment_id,
                    reason: None,
                }
            }
        }
    }
}
