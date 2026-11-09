use near_sdk::json_types::U128;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, NearToken, PromiseOrValue, PromiseResult};

use crate::payments::PENDING_NATIVE_PAYMENT_RECOVERY_DELAY_NS;
use crate::{
    Clavis, PaymentOutcome, PaymentSchedule, RecipientConfigInput, SecurityAuditScenario,
    SplitConfig, DAY_NS,
};

const UNKNOWN_HASH: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const BUSINESS_HOUR_NS: u64 = 12 * crate::HOUR_NS;
const WORKER_ACCOUNT: &str = "worker.testnet";

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
        .block_height(100)
        .account_balance(NearToken::from_near(10));
    builder
}

fn recipient_hash(account_id: &str) -> String {
    near_sdk::env::sha256(account_id.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn recipient(cap: u128, schedule: PaymentSchedule) -> RecipientConfigInput {
    RecipientConfigInput {
        name: "Ada".to_string(),
        personal_cap: U128(cap),
        active: true,
        preferred_chain: "near".to_string(),
        preferred_token: "NEAR".to_string(),
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
    contract.add_recipient(recipient_hash(WORKER_ACCOUNT), recipient(400, schedule));
    contract
}

#[test]
fn migrates_legacy_state_without_changing_policy_data() {
    testing_env!(context("owner.testnet", DAY_NS).build());
    let mut current = Clavis::new(
        account("owner.testnet"),
        account("agent.testnet"),
        U128(1_000),
        U128(500),
    );
    current.add_recipient(
        recipient_hash(WORKER_ACCOUNT),
        recipient(400, PaymentSchedule::Weekly),
    );
    let legacy = crate::LegacyClavisV1 {
        owner: current.owner,
        agent: current.agent,
        daily_limit: current.daily_limit,
        per_payment_limit: current.per_payment_limit,
        daily_spent: current.daily_spent,
        last_reset_timestamp: current.last_reset_timestamp,
        recipients: current.recipients,
        recipient_count: current.recipient_count,
        audit_log: current.audit_log,
        log_counter: current.log_counter,
        anomaly_log: current.anomaly_log,
        anomaly_counter: current.anomaly_counter,
        recipient_last_request: current.recipient_last_request,
        anomaly_last_logged: current.anomaly_last_logged,
        paused: current.paused,
    };
    near_sdk::env::state_write(&legacy);

    let migrated = Clavis::migrate();

    assert_eq!(migrated.get_owner(), account("owner.testnet"));
    assert_eq!(migrated.get_agent(), account("agent.testnet"));
    assert_eq!(migrated.get_daily_limit(), U128(1_000));
    assert_eq!(migrated.get_per_payment_limit(), U128(500));
    assert!(migrated
        .get_recipient(recipient_hash(WORKER_ACCOUNT))
        .is_some());
    assert!(migrated.pending_native_payment.is_none());
    assert_eq!(migrated.contract_version(), "0.2.0");
}

fn request(
    contract: &mut Clavis,
    hash: &str,
    amount: u128,
) -> PromiseOrValue<crate::PaymentResult> {
    contract.request_payment(
        hash.to_string(),
        U128(amount),
        "near".to_string(),
        "NEAR".to_string(),
        Some(account(WORKER_ACCOUNT)),
    )
}

fn value(result: PromiseOrValue<crate::PaymentResult>) -> crate::PaymentResult {
    match result {
        PromiseOrValue::Value(value) => value,
        PromiseOrValue::Promise(_) => panic!("Expected an immediate payment result"),
    }
}

fn expect_transfer(result: PromiseOrValue<crate::PaymentResult>) {
    assert!(matches!(result, PromiseOrValue::Promise(_)));
}

fn settle(contract: &mut Clavis, timestamp: u64, delivered: bool) -> crate::PaymentResult {
    let promise_result = if delivered {
        PromiseResult::Successful(vec![])
    } else {
        PromiseResult::Failed
    };
    testing_env!(
        context("clavis.testnet", timestamp).build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![promise_result],
    );
    contract.on_native_payment_settled()
}

#[test]
fn approves_a_valid_payment_and_writes_private_audit_shape() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());

    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 300));
    assert_eq!(contract.get_log_count(), 0);
    let result = settle(&mut contract, DAY_NS + BUSINESS_HOUR_NS + 1, true);

    assert!(result.approved);
    assert!(result.settled);
    assert_eq!(result.payment_id, 1);
    assert_eq!(contract.get_daily_spent(), U128(300));
    let entry = contract.get_audit_log(0, 10).pop().unwrap();
    assert_eq!(entry.outcome, PaymentOutcome::Approved);
}

#[test]
fn failed_native_transfer_rolls_back_reserved_policy_state() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 300));

    let result = settle(&mut contract, DAY_NS + BUSINESS_HOUR_NS + 1, false);

    assert!(!result.approved);
    assert!(!result.settled);
    assert_eq!(
        result.reason.as_deref(),
        Some("Native NEAR transfer failed")
    );
    assert_eq!(contract.get_daily_spent(), U128(0));
    assert!(contract.pending_native_payment.is_none());
    assert_eq!(
        contract
            .get_recipient(recipient_hash(WORKER_ACCOUNT))
            .unwrap()
            .last_paid,
        0
    );
}

#[test]
#[should_panic(expected = "Pending payment is not yet recoverable")]
fn stale_native_payment_cannot_be_resolved_before_finality_window() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    let requested_at = DAY_NS + BUSINESS_HOUR_NS;
    testing_env!(context("agent.testnet", requested_at).build());
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 300));

    testing_env!(context(
        "owner.testnet",
        requested_at + PENDING_NATIVE_PAYMENT_RECOVERY_DELAY_NS - 1,
    )
    .build());
    contract.resolve_stale_native_payment(
        false,
        "11111111111111111111111111111111111111111111".to_string(),
    );
}

#[test]
fn stale_failed_callback_can_be_rolled_back_with_transaction_evidence() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    let requested_at = DAY_NS + BUSINESS_HOUR_NS;
    testing_env!(context("agent.testnet", requested_at).build());
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 300));
    assert_eq!(
        contract.get_pending_native_payment_recovery_at(),
        Some(near_sdk::json_types::U64(
            requested_at + PENDING_NATIVE_PAYMENT_RECOVERY_DELAY_NS
        ))
    );

    testing_env!(context(
        "owner.testnet",
        requested_at + PENDING_NATIVE_PAYMENT_RECOVERY_DELAY_NS,
    )
    .build());
    let result = contract.resolve_stale_native_payment(
        false,
        "11111111111111111111111111111111111111111111".to_string(),
    );

    assert!(!result.approved);
    assert!(!result.settled);
    assert_eq!(contract.get_daily_spent(), U128(0));
    assert!(contract.pending_native_payment.is_none());
    assert_eq!(
        contract
            .get_recipient(recipient_hash(WORKER_ACCOUNT))
            .unwrap()
            .last_paid,
        0
    );
}

#[test]
fn stale_successful_callback_can_be_finalized_without_repaying() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    let requested_at = DAY_NS + BUSINESS_HOUR_NS;
    testing_env!(context("agent.testnet", requested_at).build());
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 300));

    testing_env!(context(
        "owner.testnet",
        requested_at + PENDING_NATIVE_PAYMENT_RECOVERY_DELAY_NS,
    )
    .build());
    let result = contract.resolve_stale_native_payment(
        true,
        "11111111111111111111111111111111111111111111".to_string(),
    );

    assert!(result.approved);
    assert!(result.settled);
    assert_eq!(contract.get_daily_spent(), U128(300));
    assert!(contract.pending_native_payment.is_none());
    assert_eq!(contract.get_log_count(), 1);
}

#[test]
fn rejects_another_request_while_native_transfer_is_pending() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 100));

    let result = value(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 100));

    assert_eq!(result.payment_id, 0);
    assert_eq!(
        result.reason.as_deref(),
        Some("A native payment transfer is already pending")
    );
}

#[test]
fn rejects_native_destination_that_does_not_match_commitment() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());

    let result = value(contract.request_payment(
        recipient_hash(WORKER_ACCOUNT),
        U128(100),
        "near".to_string(),
        "NEAR".to_string(),
        Some(account("attacker.testnet")),
    ));

    assert_eq!(
        result.reason.as_deref(),
        Some("Native NEAR recipient does not match the approved commitment")
    );
    assert_eq!(contract.get_daily_spent(), U128(0));
}

#[test]
fn cross_chain_authorization_fails_closed_before_policy_is_consumed() {
    testing_env!(context("owner.testnet", DAY_NS).build());
    let mut contract = Clavis::new(
        account("owner.testnet"),
        account("agent.testnet"),
        U128(1_000),
        U128(500),
    );
    let mut config = recipient(400, PaymentSchedule::Milestone);
    config.preferred_chain = "ethereum".to_string();
    config.preferred_token = "USDC".to_string();
    contract.add_recipient(recipient_hash(WORKER_ACCOUNT), config);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());

    let result = value(contract.request_payment(
        recipient_hash(WORKER_ACCOUNT),
        U128(100),
        "ethereum".to_string(),
        "USDC".to_string(),
        Some(account(WORKER_ACCOUNT)),
    ));

    assert_eq!(
        result.reason.as_deref(),
        Some("Cross-chain settlement is not contract-controlled in this release")
    );
    assert_eq!(contract.get_daily_spent(), U128(0));
    assert_eq!(
        contract
            .get_recipient(recipient_hash(WORKER_ACCOUNT))
            .unwrap()
            .last_paid,
        0
    );
}

#[test]
fn rejects_a_transfer_that_would_consume_storage_and_operational_reserves() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    let mut constrained = context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS);
    constrained
        .account_balance(NearToken::from_near(6))
        .storage_usage(500_000);
    testing_env!(constrained.build());

    let result = value(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 1));

    assert_eq!(
        result.reason.as_deref(),
        Some("Insufficient contract treasury balance")
    );
    assert_eq!(contract.get_daily_spent(), U128(0));
    assert!(contract.pending_native_payment.is_none());
}

#[test]
fn rejects_off_hours_payment_and_records_anomaly() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + crate::HOUR_NS).build());

    let result = value(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 100));

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
        value(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 100,))
            .reason
            .unwrap(),
        "Contract paused"
    );
}

#[test]
fn rule_2_rejects_unauthorized_caller() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("attacker.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    let result = value(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 100));
    assert_eq!(result.reason.unwrap(), "Unauthorized caller");
    assert_eq!(result.payment_id, 0);
    assert_eq!(contract.get_log_count(), 0);
}

#[test]
fn rejects_malformed_recipient_hash_without_unbounded_request_state() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    let result = value(request(&mut contract, "not-a-hash", 100));
    assert_eq!(result.reason.unwrap(), "Invalid recipient hash");
    assert_eq!(contract.get_log_count(), 1);
}

#[test]
fn rule_3_rejects_unknown_recipient() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    assert_eq!(
        value(request(&mut contract, UNKNOWN_HASH, 100))
            .reason
            .unwrap(),
        "Recipient not approved"
    );
}

#[test]
fn rule_4_rejects_suspended_recipient() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("owner.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    contract.suspend_recipient(recipient_hash(WORKER_ACCOUNT));
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS + 1).build());
    assert_eq!(
        value(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 100,))
            .reason
            .unwrap(),
        "Recipient suspended"
    );
}

#[test]
fn rule_5_rejects_global_limit_breach() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    assert_eq!(
        value(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 501,))
            .reason
            .unwrap(),
        "Exceeds per-payment limit"
    );
}

#[test]
fn rule_6_rejects_personal_cap_breach() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    assert_eq!(
        value(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 401,))
            .reason
            .unwrap(),
        "Exceeds recipient cap"
    );
}

#[test]
fn rule_7_resets_spend_after_twenty_four_hours() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 400));
    assert!(settle(&mut contract, DAY_NS + BUSINESS_HOUR_NS + 1, true).approved);
    testing_env!(context("agent.testnet", DAY_NS * 2 + BUSINESS_HOUR_NS).build());
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 400));
    assert!(settle(&mut contract, DAY_NS * 2 + BUSINESS_HOUR_NS + 1, true).approved);
    assert_eq!(contract.get_daily_spent(), U128(400));
}

#[test]
fn rule_8_rejects_daily_limit_breach() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 400));
    assert!(settle(&mut contract, DAY_NS + BUSINESS_HOUR_NS + 1, true).approved);
    testing_env!(context(
        "agent.testnet",
        DAY_NS + BUSINESS_HOUR_NS + 2 * crate::MINUTE_NS,
    )
    .build());
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 400));
    assert!(
        settle(
            &mut contract,
            DAY_NS + BUSINESS_HOUR_NS + 2 * crate::MINUTE_NS + 1,
            true,
        )
        .approved
    );
    testing_env!(context(
        "agent.testnet",
        DAY_NS + BUSINESS_HOUR_NS + 4 * crate::MINUTE_NS,
    )
    .build());
    assert_eq!(
        value(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 300,))
            .reason
            .unwrap(),
        "Daily limit exceeded"
    );
}

#[test]
fn rejects_early_scheduled_payment() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 200));
    assert!(settle(&mut contract, DAY_NS + BUSINESS_HOUR_NS + 1, true).approved);
    testing_env!(context("agent.testnet", DAY_NS * 2 + BUSINESS_HOUR_NS).build());
    assert_eq!(
        value(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 200,))
            .reason
            .unwrap(),
        "Payment is not due"
    );
}

#[test]
fn rejects_unregistered_destination_route() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + BUSINESS_HOUR_NS).build());
    let result = value(contract.request_payment(
        recipient_hash(WORKER_ACCOUNT),
        U128(100),
        "bnb".to_string(),
        "BUSD".to_string(),
        Some(account(WORKER_ACCOUNT)),
    ));
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
    contract.add_recipient(recipient_hash(WORKER_ACCOUNT), config);
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
    contract.add_recipient(UNKNOWN_HASH.to_string(), config);

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
        .get(&recipient_hash(WORKER_ACCOUNT))
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
            .get(&recipient_hash(WORKER_ACCOUNT))
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
    expect_transfer(request(&mut contract, &recipient_hash(WORKER_ACCOUNT), 100));
    let result = settle(&mut contract, DAY_NS + BUSINESS_HOUR_NS + 2, true);

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
