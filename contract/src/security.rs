use near_sdk::near_bindgen;

use crate::types::{
    PaymentOutcome, PaymentSchedule, RecipientConfig, RuleResult, SecurityAuditResult,
    SecurityAuditScenario,
};
use crate::{Clavis, ClavisExt, HOUR_NS};

const SECURITY_AUDIT_SCENARIO_COUNT: u64 = 5;

#[near_bindgen]
impl Clavis {
    /// Runs the fixed security-audit sandbox used by the browser dashboard.
    ///
    /// The audit deliberately does not submit a real payment, alter recipient
    /// policy, consume a daily limit, or move funds. Each canonical attack is
    /// rejected inside the contract and written through the same privacy-safe
    /// public audit path as a payment decision.
    pub fn run_security_audit(&mut self) -> Vec<SecurityAuditResult> {
        self.assert_owner();
        assert!(
            self.log_counter <= u64::MAX - SECURITY_AUDIT_SCENARIO_COUNT,
            "Audit log counter is exhausted"
        );

        let active_recipient = Self::audit_recipient(true);
        let mut suspended_recipient = active_recipient.clone();
        suspended_recipient.active = false;
        let business_hours = 12 * HOUR_NS;
        let off_hours = HOUR_NS;

        let scenarios = [
            (
                SecurityAuditScenario::UnapprovedRecipient,
                Self::evaluate_rules(
                    false,
                    true,
                    None,
                    1,
                    self.per_payment_limit,
                    0,
                    self.daily_limit,
                    business_hours,
                    "near",
                    "NEAR",
                ),
            ),
            (
                SecurityAuditScenario::OverLimitPayment,
                Self::evaluate_rules(
                    false,
                    true,
                    Some(active_recipient.clone()),
                    2,
                    1,
                    0,
                    2,
                    business_hours,
                    "near",
                    "NEAR",
                ),
            ),
            (
                SecurityAuditScenario::SuspendedRecipient,
                Self::evaluate_rules(
                    false,
                    true,
                    Some(suspended_recipient),
                    1,
                    self.per_payment_limit,
                    0,
                    self.daily_limit,
                    business_hours,
                    "near",
                    "NEAR",
                ),
            ),
            (
                SecurityAuditScenario::DailyLimitBreach,
                Self::evaluate_rules(
                    false,
                    true,
                    Some(active_recipient.clone()),
                    1,
                    1,
                    1,
                    1,
                    business_hours,
                    "near",
                    "NEAR",
                ),
            ),
            (
                SecurityAuditScenario::OffHoursPayment,
                Self::evaluate_rules(
                    false,
                    true,
                    Some(active_recipient),
                    1,
                    self.per_payment_limit,
                    0,
                    self.daily_limit,
                    off_hours,
                    "near",
                    "NEAR",
                ),
            ),
        ];

        scenarios
            .into_iter()
            .map(|(scenario, outcome)| self.record_security_audit_result(scenario, outcome))
            .collect()
    }
}

impl Clavis {
    fn audit_recipient(active: bool) -> RecipientConfig {
        RecipientConfig {
            name: "Security audit recipient".to_string(),
            personal_cap: u128::MAX,
            active,
            preferred_chain: "near".to_string(),
            preferred_token: "NEAR".to_string(),
            payment_split: vec![],
            schedule: PaymentSchedule::Milestone,
            last_paid: 0,
        }
    }

    fn record_security_audit_result(
        &mut self,
        scenario: SecurityAuditScenario,
        outcome: RuleResult,
    ) -> SecurityAuditResult {
        match outcome {
            RuleResult::Rejected(rule_reason) => {
                let reason = format!("Security audit: {rule_reason}");
                let payment_id = self.append_audit(PaymentOutcome::Rejected(reason.clone()));
                SecurityAuditResult {
                    scenario,
                    blocked: true,
                    reason,
                    payment_id,
                }
            }
            RuleResult::Approved(_) => {
                let reason = "Security audit: Attack was not blocked".to_string();
                let payment_id = self.append_audit(PaymentOutcome::Approved);
                SecurityAuditResult {
                    scenario,
                    blocked: false,
                    reason,
                    payment_id,
                }
            }
        }
    }
}
