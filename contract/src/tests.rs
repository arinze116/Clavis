use near_sdk::json_types::U128;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId};

use crate::{
    Clavis, PaymentOutcome, PaymentSchedule, RecipientConfigInput, SecurityAuditScenario,
    SplitConfig, DAY_NS,
};

const RECIPIENT_HASH: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const UNKNOWN_HASH: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const BUSINESS_HOUR_NS: u64 = 12 * crate::HOUR_NS;

fn account(value: &str) -> AccountId {
    value.parse().unwrap()
}

fn context(predecessor: &str, timestamp: u64) -> VMContextBuilder {
    let mut builder = VMContextBuilder::new();
    builder
        .current_account_id(account("clavis.testnet"))
        .signer_account_id(account(predecessor))
        .predecessor_account_id(account(predecessor))
        .block_timestamp(timestamp)
        .block_height(100);
    builder
}

fn recipient(cap: u128, schedule: PaymentSchedule) -> RecipientConfigInput {
    RecipientConfigInput {
        name: "Ada".to_string(),
        personal_cap: U128(cap),
        active: true,
        preferred_chain: "ethereum".to_string(),
        preferred_token: "USDC".to_string(),
        payment_split: vec![],
        schedule,
    }
}

fn configured_contract(schedule: PaymentSchedule) -> Clavis {
    testing_env!(context("owner.testnet", DAY_NS).build());
    let mut contract = Clavis::new(
        account("owner.testnet"),
        account("agent.testnet"),
        U128(1_000),
        U128(500),
    );
    contract.add_recipient(RECIPIENT_HASH.to_string(), recipient(400, schedule));
    contract
}

fn request(contract: &mut Clavis, hash: &str, amount: u128) -> crate::PaymentResult {
    contract.request_payment(
        hash.to_string(),
        U128(amount),
        "ethereum".to_string(),
        "USDC".to_string(),
    )
}

#[test]
fn approves_a_valid_payment_and_writes_private_audit_shape() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());

    let result = request(&mut contract, RECIPIENT_HASH, 300);

    assert!(result.approved);
    assert_eq!(result.payment_id, 1);
    assert_eq!(contract.get_daily_spent(), U128(300));
    let entry = contract.get_audit_log(0, 10).pop().unwrap();
    assert_eq!(entry.outcome, PaymentOutcome::Approved);
}

#[test]
fn rejects_off_hours_payment_and_records_anomaly() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + crate::HOUR_NS).build());

    let result = request(&mut contract, RECIPIENT_HASH, 100);

    assert!(!result.approved);
    assert_eq!(result.reason.as_deref(), Some("Off-hours payment blocked"));
    assert_eq!(contract.get_daily_spent(), U128(0));
    assert_eq!(contract.get_log_count(), 1);
    let anomalies = contract.get_anomalies(0, 10, false);
    assert_eq!(anomalies.len(), 1);
    assert_eq!(anomalies[0].anomaly_type, "OFF_HOURS");
    assert_eq!(
        anomalies[0].description,
        "Payment activity between 00:00 and 06:00 UTC"
    );
}

#[test]
fn rule_1_rejects_when_paused() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("owner.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    contract.pause();
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS + 1).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 100).reason.unwrap(),
        "Contract paused"
    );
}

#[test]
fn rule_2_rejects_unauthorized_caller() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("attacker.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    let result = request(&mut contract, RECIPIENT_HASH, 100);
    assert_eq!(result.reason.unwrap(), "Unauthorized caller");
    assert_eq!(result.payment_id, 0);
    assert_eq!(contract.get_log_count(), 0);
}

#[test]
fn rejects_malformed_recipient_hash_without_unbounded_request_state() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    let result = request(&mut contract, "not-a-hash", 100);
    assert_eq!(result.reason.unwrap(), "Invalid recipient hash");
    assert_eq!(contract.get_log_count(), 1);
}

#[test]
fn rule_3_rejects_unknown_recipient() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    assert_eq!(
        request(&mut contract, UNKNOWN_HASH, 100).reason.unwrap(),
        "Recipient not approved"
    );
}

#[test]
fn rule_4_rejects_suspended_recipient() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("owner.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    contract.suspend_recipient(RECIPIENT_HASH.to_string());
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS + 1).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 100).reason.unwrap(),
        "Recipient suspended"
    );
}

#[test]
fn rule_5_rejects_global_limit_breach() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 501).reason.unwrap(),
        "Exceeds per-payment limit"
    );
}

#[test]
fn rule_6_rejects_personal_cap_breach() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 401).reason.unwrap(),
        "Exceeds recipient cap"
    );
}

#[test]
fn rule_7_resets_spend_after_twenty_four_hours() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    assert!(request(&mut contract, RECIPIENT_HASH, 400).approved);
    testing_env!(context("agent.testnet", DAY_NS * 2 + BUSINESS_HOUR_NS).build());
    assert!(request(&mut contract, RECIPIENT_HASH, 400).approved);
    assert_eq!(contract.get_daily_spent(), U128(400));
}

#[test]
fn rule_8_rejects_daily_limit_breach() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    assert!(request(&mut contract, RECIPIENT_HASH, 400).approved);
    testing_env!(context(
        "agent.testnet",
        DAY_NS + BUSINESS_HOUR_NS + 2 * crate::MINUTE_NS,
    )
    .build());
    assert!(request(&mut contract, RECIPIENT_HASH, 400).approved);
    testing_env!(context(
        "agent.testnet",
        DAY_NS + BUSINESS_HOUR_NS + 4 * crate::MINUTE_NS,
    )
    .build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 300).reason.unwrap(),
        "Daily limit exceeded"
    );
}

#[test]
fn rejects_early_scheduled_payment() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    assert!(request(&mut contract, RECIPIENT_HASH, 200).approved);
    testing_env!(context("agent.testnet", DAY_NS * 2 + BUSINESS_HOUR_NS).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 200).reason.unwrap(),
        "Payment is not due"
    );
}

#[test]
fn rejects_unregistered_destination_route() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    let result = contract.request_payment(
        RECIPIENT_HASH.to_string(),
        U128(100),
        "bnb".to_string(),
        "BUSD".to_string(),
    );
    assert_eq!(result.reason.unwrap(), "Destination route not approved");
}

#[test]
fn validates_payment_splits() {
    testing_env!(context("owner.testnet", DAY_NS).build());
    let mut contract = Clavis::new(
        account("owner.testnet"),
        account("agent.testnet"),
        U128(1_000),
        U128(500),
    );
    let mut config = recipient(400, PaymentSchedule::Weekly);
    config.payment_split = vec![
        SplitConfig {
            chain: "near".to_string(),
            token: "NEAR".to_string(),
            percentage: 70,
        },
        SplitConfig {
            chain: "ethereum".to_string(),
            token: "USDC".to_string(),
            percentage: 30,
        },
    ];
    contract.add_recipient(RECIPIENT_HASH.to_string(), config);
    assert_eq!(contract.get_recipient_count(), 1);
}

#[test]
fn reports_near_worker_registration_from_plaintext_name() {
    testing_env!(context("owner.testnet", DAY_NS).build());
    let mut contract = Clavis::new(
        account("owner.testnet"),
        account("agent.testnet"),
        U128(1_000),
        U128(500),
    );
    let mut config = recipient(400, PaymentSchedule::Weekly);
    config.name = "Ada · ada-worker.testnet".to_string();
    config.preferred_chain = "near".to_string();
    config.preferred_token = "NEAR".to_string();
    contract.add_recipient(RECIPIENT_HASH.to_string(), config);

    assert!(contract.is_registered(account("ada-worker.testnet")));
    assert!(!contract.is_registered(account("unknown.testnet")));
}

#[test]
fn reports_registration_from_hashed_near_account() {
    testing_env!(context("owner.testnet", DAY_NS).build());
    let mut contract = Clavis::new(
        account("owner.testnet"),
        account("agent.testnet"),
        U128(1_000),
        U128(500),
    );
    let mut config = recipient(400, PaymentSchedule::Weekly);
    config.preferred_chain = "near".to_string();
    config.preferred_token = "NEAR".to_string();
    let worker_hash = near_sdk::env::sha256(b"hash-worker.testnet")
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    contract.add_recipient(worker_hash, config);

    assert!(contract.is_registered(account("hash-worker.testnet")));
}

#[test]
fn owner_security_audit_logs_five_blocked_scenarios_without_mutating_policy() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    let recipient_before = contract
        .recipients
        .get(&RECIPIENT_HASH.to_string())
        .unwrap();
    let daily_spent_before = contract.get_daily_spent();
    let last_reset_before = contract.get_last_reset_timestamp();
    let paused_before = contract.is_paused();
    let anomaly_count_before = contract.get_anomaly_count();
    testing_env!(context("owner.testnet", DAY_NS + 1).build());

    let results = contract.run_security_audit();

    assert_eq!(results.len(), 5);
    assert_eq!(
        results
            .iter()
            .map(|result| result.scenario.clone())
            .collect::<Vec<_>>(),
        vec![
            SecurityAuditScenario::UnapprovedRecipient,
            SecurityAuditScenario::OverLimitPayment,
            SecurityAuditScenario::SuspendedRecipient,
            SecurityAuditScenario::DailyLimitBreach,
            SecurityAuditScenario::OffHoursPayment,
        ]
    );
    assert!(results.iter().all(|result| result.blocked));
    assert_eq!(
        results
            .iter()
            .map(|result| result.reason.as_str())
            .collect::<Vec<_>>(),
        vec![
            "Security audit: Recipient not approved",
            "Security audit: Exceeds per-payment limit",
            "Security audit: Recipient suspended",
            "Security audit: Daily limit exceeded",
            "Security audit: Off-hours payment blocked",
        ]
    );
    assert_eq!(
        results
            .iter()
            .map(|result| result.payment_id)
            .collect::<Vec<_>>(),
        vec![1, 2, 3, 4, 5]
    );
    assert_eq!(contract.get_log_count(), 5);

    let audit_entries = contract.get_audit_log(0, 10);
    assert_eq!(audit_entries.len(), 5);
    for (entry, result) in audit_entries.iter().zip(results.iter()) {
        assert_eq!(
            entry.outcome,
            PaymentOutcome::Rejected(result.reason.clone())
        );
        assert_eq!(entry.payment_id, result.payment_id);
    }

    assert_eq!(contract.get_daily_spent(), daily_spent_before);
    assert_eq!(contract.get_last_reset_timestamp(), last_reset_before);
    assert_eq!(contract.is_paused(), paused_before);
    assert_eq!(contract.get_anomaly_count(), anomaly_count_before);
    assert_eq!(contract.get_recipient_count(), 1);
    assert_eq!(
        contract
            .recipients
            .get(&RECIPIENT_HASH.to_string())
            .unwrap(),
        recipient_before
    );
}

#[test]
fn security_probe_entries_do_not_trigger_high_frequency_payment_anomalies() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("owner.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    contract.run_security_audit();
    contract.run_security_audit();

    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS + 1).build());
    let result = request(&mut contract, RECIPIENT_HASH, 100);

    assert!(result.approved);
    assert!(contract
        .get_anomalies(0, 20, false)
        .iter()
        .all(|anomaly| anomaly.anomaly_type != "HIGH_FREQUENCY"));
}

#[test]
fn security_audit_is_stable_at_u128_limit_boundaries() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    contract.daily_limit = u128::MAX;
    contract.per_payment_limit = u128::MAX;
    testing_env!(context("owner.testnet", DAY_NS + 1).build());

    let results = contract.run_security_audit();

    assert!(results.iter().all(|result| result.blocked));
    assert_eq!(
        results[1].reason,
        "Security audit: Exceeds per-payment limit"
    );
    assert_eq!(results[3].reason, "Security audit: Daily limit exceeded");
}

#[test]
fn non_owner_cannot_run_security_audit_or_append_entries() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    testing_env!(context("attacker.testnet", DAY_NS + 1).build());

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.run_security_audit()
    }));

    assert!(result.is_err());
    assert_eq!(contract.get_log_count(), 0);
    assert!(contract.get_audit_log(0, 10).is_empty());
}

#[test]
fn pure_rule_evaluator_rejects_daily_spend_overflow() {
    let config = recipient(u128::MAX, PaymentSchedule::Milestone).into();

    let result = Clavis::evaluate_rules(
        false,
        true,
        Some(config),
        1,
        u128::MAX,
        u128::MAX,
        u128::MAX,
        BUSINESS_HOUR_NS,
        "ethereum",
        "USDC",
    );

    assert_eq!(
        result,
        crate::types::RuleResult::Rejected("Daily spend overflow".to_string())
    );
}

#[test]
fn security_audit_fails_before_writing_when_log_counter_is_exhausted() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    contract.log_counter = u64::MAX - 4;
    testing_env!(context("owner.testnet", DAY_NS + 1).build());

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.run_security_audit()
    }));

    assert!(result.is_err());
    assert_eq!(contract.log_counter, u64::MAX - 4);
    assert!(contract.get_audit_log(0, 10).is_empty());
}
