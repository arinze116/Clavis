use near_sdk::env;

use crate::types::{RecipientConfig, RuleResult};
use crate::{Clavis, DAY_NS};

impl Clavis {
    /// Evaluates the complete payment policy without mutating contract state.
    ///
    /// Keeping the evaluator pure lets the owner security audit probe the same
    /// rules as a real agent request without changing recipients, spend
    /// counters, schedules, or treasury state.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn evaluate_rules(
        paused: bool,
        caller_authorized: bool,
        recipient: Option<RecipientConfig>,
        amount: u128,
        per_payment_limit: u128,
        daily_spent: u128,
        daily_limit: u128,
        timestamp: u64,
        chain: &str,
        token: &str,
    ) -> RuleResult {
        // Rule 1: Contract is not paused.
        if paused {
            return RuleResult::Rejected("Contract paused".to_string());
        }

        // Rule 2: Caller is the authorized agent.
        if !caller_authorized {
            return RuleResult::Rejected("Unauthorized caller".to_string());
        }

        // Payments are intentionally fail-closed between midnight and 06:00
        // UTC. The anomaly log records the attempt separately.
        if Self::is_off_hours_at(timestamp) {
            return RuleResult::Rejected("Off-hours payment blocked".to_string());
        }

        // Rule 3: Recipient exists in the allowlist.
        let recipient = match recipient {
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
        if amount > per_payment_limit {
            return RuleResult::Rejected("Exceeds per-payment limit".to_string());
        }

        // Rule 6: Amount is within the recipient's personal cap.
        if amount > recipient.personal_cap {
            return RuleResult::Rejected("Exceeds recipient cap".to_string());
        }

        // Rule 8: The addition must be safe and remain inside the daily limit.
        let projected_spend = match daily_spent.checked_add(amount) {
            Some(value) => value,
            None => return RuleResult::Rejected("Daily spend overflow".to_string()),
        };
        if projected_spend > daily_limit {
            return RuleResult::Rejected("Daily limit exceeded".to_string());
        }

        if !Self::is_schedule_due_at(&recipient, timestamp) {
            return RuleResult::Rejected("Payment is not due".to_string());
        }

        if !Self::is_registered_route(&recipient, chain, token) {
            return RuleResult::Rejected("Destination route not approved".to_string());
        }

        RuleResult::Approved(recipient)
    }

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
        // Rule 7: Reset the rolling daily counter once the window expires.
        self.reset_daily_if_needed();
        Self::evaluate_rules(
            self.paused,
            env::predecessor_account_id() == self.agent,
            self.recipients.get(recipient_hash),
            amount,
            self.per_payment_limit,
            self.daily_spent,
            self.daily_limit,
            env::block_timestamp(),
            chain,
            token,
        )
    }

    pub(crate) fn reset_daily_if_needed(&mut self) {
        let now = env::block_timestamp();
        if now.saturating_sub(self.last_reset_timestamp) >= DAY_NS {
            self.daily_spent = 0;
            self.last_reset_timestamp = now;
        }
    }
}
