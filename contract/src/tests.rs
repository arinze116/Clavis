use near_sdk::json_types::U128;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId};

use crate::{Clavis, PaymentOutcome, PaymentSchedule, RecipientConfigInput, SplitConfig, DAY_NS};

const RECIPIENT_HASH: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const UNKNOWN_HASH: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

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
    testing_env!(context("agent.testnet", DAY_NS + 1).build());

    let result = request(&mut contract, RECIPIENT_HASH, 300);

    assert!(result.approved);
    assert_eq!(result.payment_id, 1);
    assert_eq!(contract.get_daily_spent(), U128(300));
    let entry = contract.get_audit_log(0, 10).pop().unwrap();
    assert_eq!(entry.outcome, PaymentOutcome::Approved);
}

#[test]
fn rule_1_rejects_when_paused() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("owner.testnet", DAY_NS + 1).build());
    contract.pause();
    testing_env!(context("agent.testnet", DAY_NS + 2).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 100).reason.unwrap(),
        "Contract paused"
    );
}

#[test]
fn rule_2_rejects_unauthorized_caller() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("attacker.testnet", DAY_NS + 1).build());
    let result = request(&mut contract, RECIPIENT_HASH, 100);
    assert_eq!(result.reason.unwrap(), "Unauthorized caller");
    assert_eq!(result.payment_id, 0);
    assert_eq!(contract.get_log_count(), 0);
}

#[test]
fn rejects_malformed_recipient_hash_without_unbounded_request_state() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + 1).build());
    let result = request(&mut contract, "not-a-hash", 100);
    assert_eq!(result.reason.unwrap(), "Invalid recipient hash");
    assert_eq!(contract.get_log_count(), 1);
}

#[test]
fn rule_3_rejects_unknown_recipient() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + 1).build());
    assert_eq!(
        request(&mut contract, UNKNOWN_HASH, 100).reason.unwrap(),
        "Recipient not approved"
    );
}

#[test]
fn rule_4_rejects_suspended_recipient() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("owner.testnet", DAY_NS + 1).build());
    contract.suspend_recipient(RECIPIENT_HASH.to_string());
    testing_env!(context("agent.testnet", DAY_NS + 2).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 100).reason.unwrap(),
        "Recipient suspended"
    );
}

#[test]
fn rule_5_rejects_global_limit_breach() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + 1).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 501).reason.unwrap(),
        "Exceeds per-payment limit"
    );
}

#[test]
fn rule_6_rejects_personal_cap_breach() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + 1).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 401).reason.unwrap(),
        "Exceeds recipient cap"
    );
}

#[test]
fn rule_7_resets_spend_after_twenty_four_hours() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + 1).build());
    assert!(request(&mut contract, RECIPIENT_HASH, 400).approved);
    testing_env!(context("agent.testnet", DAY_NS * 2 + 2).build());
    assert!(request(&mut contract, RECIPIENT_HASH, 400).approved);
    assert_eq!(contract.get_daily_spent(), U128(400));
}

#[test]
fn rule_8_rejects_daily_limit_breach() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + 1).build());
    assert!(request(&mut contract, RECIPIENT_HASH, 400).approved);
    testing_env!(context("agent.testnet", DAY_NS + 2 * crate::MINUTE_NS).build());
    assert!(request(&mut contract, RECIPIENT_HASH, 400).approved);
    testing_env!(context("agent.testnet", DAY_NS + 4 * crate::MINUTE_NS).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 300).reason.unwrap(),
        "Daily limit exceeded"
    );
}

#[test]
fn rejects_early_scheduled_payment() {
    let mut contract = configured_contract(PaymentSchedule::Weekly);
    testing_env!(context("agent.testnet", DAY_NS + 1).build());
    assert!(request(&mut contract, RECIPIENT_HASH, 200).approved);
    testing_env!(context("agent.testnet", DAY_NS + DAY_NS).build());
    assert_eq!(
        request(&mut contract, RECIPIENT_HASH, 200).reason.unwrap(),
        "Payment is not due"
    );
}

#[test]
fn rejects_unregistered_destination_route() {
    let mut contract = configured_contract(PaymentSchedule::Milestone);
    testing_env!(context("agent.testnet", DAY_NS + 1).build());
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
