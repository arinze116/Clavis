use near_sdk::env;

use crate::types::RuleResult;
use crate::{Clavis, DAY_NS};

impl Clavis {
    /// Runs the immutable payment policy in a stable order. The schedule and
    /// registered route checks extend the PRD's eight core checks so a stolen
    /// agent key cannot pay early or redirect an approved payment.
    pub(crate) fn enforce_rules(
        &mut self,
        recipient_hash: &String,
        amount: u128,
        chain: &str,
        token: &str,
    ) -> RuleResult {
        // Rule 1: Contract is not paused.
        if self.paused {
            return RuleResult::Rejected("Contract paused".to_string());
        }

        // Rule 2: Caller is the authorized agent.
        if env::predecessor_account_id() != self.agent {
            return RuleResult::Rejected("Unauthorized caller".to_string());
        }

        // Rule 3: Recipient exists in the allowlist.
        let recipient = match self.recipients.get(recipient_hash) {
            Some(recipient) => recipient,
            None => return RuleResult::Rejected("Recipient not approved".to_string()),
        };

        // Rule 4: Recipient is active.
        if !recipient.active {
            return RuleResult::Rejected("Recipient suspended".to_string());
        }

        if amount == 0 {
            return RuleResult::Rejected("Amount must be greater than zero".to_string());
        }

        // Rule 5: Amount is within the global per-payment limit.
        if amount > self.per_payment_limit {
            return RuleResult::Rejected("Exceeds per-payment limit".to_string());
        }

        // Rule 6: Amount is within the recipient's personal cap.
        if amount > recipient.personal_cap {
            return RuleResult::Rejected("Exceeds recipient cap".to_string());
        }

        // Rule 7: Reset the rolling daily counter once the window expires.
        self.reset_daily_if_needed();

        // Rule 8: The addition must be safe and remain inside the daily limit.
        let projected_spend = match self.daily_spent.checked_add(amount) {
            Some(value) => value,
            None => return RuleResult::Rejected("Daily spend overflow".to_string()),
        };
        if projected_spend > self.daily_limit {
            return RuleResult::Rejected("Daily limit exceeded".to_string());
        }

        if !Self::is_schedule_due(&recipient) {
            return RuleResult::Rejected("Payment is not due".to_string());
        }

        if !Self::is_registered_route(&recipient, chain, token) {
            return RuleResult::Rejected("Destination route not approved".to_string());
        }

        RuleResult::Approved(recipient)
    }

    pub(crate) fn reset_daily_if_needed(&mut self) {
        let now = env::block_timestamp();
        if now.saturating_sub(self.last_reset_timestamp) >= DAY_NS {
            self.daily_spent = 0;
            self.last_reset_timestamp = now;
        }
    }
}
