use std::collections::HashSet;

use near_sdk::json_types::U128;
use near_sdk::{near_bindgen, AccountId};

use crate::types::{
    PaymentSchedule, RecipientConfig, RecipientConfigInput, RecipientView, SplitConfig,
};
use crate::{Clavis, ClavisExt, MAX_PAGE_SIZE, MAX_RECIPIENTS};

const SUPPORTED_ROUTES: &[(&str, &str)] =
    &[("near", "NEAR"), ("ethereum", "USDC"), ("bnb", "BUSD")];

impl Clavis {
    fn assert_recipient_not_settling(&self, recipient_hash: &str) {
        assert!(
            self.pending_native_payment
                .as_ref()
                .is_none_or(|pending| pending.recipient_hash != recipient_hash),
            "Recipient has a native payment transfer in progress"
        );
    }

    fn validate_recipient_hash(recipient_hash: &str) {
        assert_eq!(
            recipient_hash.len(),
            64,
            "Recipient hash must be a lowercase SHA-256 hex digest"
        );
        assert!(
            recipient_hash
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)),
            "Recipient hash must be a lowercase SHA-256 hex digest"
        );
    }

    fn validate_route(chain: &str, token: &str) {
        assert!(
            SUPPORTED_ROUTES
                .iter()
                .any(|(allowed_chain, allowed_token)| {
                    chain == *allowed_chain && token == *allowed_token
                }),
            "Unsupported chain and token pair"
        );
    }

    fn validate_splits(splits: &[SplitConfig]) {
        if splits.is_empty() {
            return;
        }

        assert!(
            splits.len() <= 3,
            "At most three payment splits are supported"
        );
        let mut routes = HashSet::new();
        let mut total = 0_u16;

        for split in splits {
            Self::validate_route(&split.chain, &split.token);
            assert!(split.percentage > 0, "Split percentages must be positive");
            assert!(
                routes.insert((split.chain.clone(), split.token.clone())),
                "Duplicate split route"
            );
            total += u16::from(split.percentage);
        }

        assert_eq!(total, 100, "Payment split percentages must sum to 100");
    }

    fn validate_config(config: &RecipientConfigInput) {
        let name = config.name.trim();
        assert!(!name.is_empty(), "Recipient name is required");
        assert!(name.chars().count() <= 80, "Recipient name is too long");
        assert!(config.personal_cap.0 > 0, "Personal cap must be positive");
        Self::validate_route(&config.preferred_chain, &config.preferred_token);
        Self::validate_splits(&config.payment_split);
    }

    fn recipient_view(recipient_hash: String, recipient: RecipientConfig) -> RecipientView {
        RecipientView {
            recipient_hash,
            name: recipient.name.clone(),
            personal_cap: U128(recipient.personal_cap),
            active: recipient.active,
            preferred_chain: recipient.preferred_chain.clone(),
            preferred_token: recipient.preferred_token.clone(),
            payment_split: recipient.payment_split.clone(),
            schedule: recipient.schedule.clone(),
            last_paid: recipient.last_paid,
            next_payment_at: Self::next_payment_at(&recipient),
        }
    }
}

#[near_bindgen]
impl Clavis {
    pub fn add_recipient(&mut self, recipient_hash: String, config: RecipientConfigInput) {
        self.assert_owner();
        Self::validate_recipient_hash(&recipient_hash);
        Self::validate_config(&config);
        assert!(
            self.recipients.get(&recipient_hash).is_none(),
            "Recipient already exists"
        );
        assert!(
            self.recipient_count < MAX_RECIPIENTS,
            "Recipient limit reached"
        );

        self.recipients.insert(&recipient_hash, &config.into());
        self.recipient_count += 1;
    }

    pub fn remove_recipient(&mut self, recipient_hash: String) {
        self.assert_owner();
        self.assert_recipient_not_settling(&recipient_hash);
        assert!(
            self.recipients.remove(&recipient_hash).is_some(),
            "Recipient not found"
        );
        self.recipient_last_request.remove(&recipient_hash);
        self.recipient_count = self.recipient_count.saturating_sub(1);
    }

    pub fn suspend_recipient(&mut self, recipient_hash: String) {
        self.set_recipient_active(recipient_hash, false);
    }

    pub fn reinstate_recipient(&mut self, recipient_hash: String) {
        self.set_recipient_active(recipient_hash, true);
    }

    pub fn update_recipient_cap(&mut self, recipient_hash: String, personal_cap: U128) {
        self.assert_owner();
        self.assert_recipient_not_settling(&recipient_hash);
        assert!(personal_cap.0 > 0, "Personal cap must be positive");
        let mut recipient = self
            .recipients
            .get(&recipient_hash)
            .expect("Recipient not found");
        recipient.personal_cap = personal_cap.0;
        self.recipients.insert(&recipient_hash, &recipient);
    }

    pub fn update_schedule(&mut self, recipient_hash: String, schedule: PaymentSchedule) {
        self.assert_owner();
        self.assert_recipient_not_settling(&recipient_hash);
        let mut recipient = self
            .recipients
            .get(&recipient_hash)
            .expect("Recipient not found");
        recipient.schedule = schedule;
        self.recipients.insert(&recipient_hash, &recipient);
    }

    pub fn update_recipient_route(
        &mut self,
        recipient_hash: String,
        preferred_chain: String,
        preferred_token: String,
        payment_split: Vec<SplitConfig>,
    ) {
        self.assert_owner();
        self.assert_recipient_not_settling(&recipient_hash);
        Self::validate_route(&preferred_chain, &preferred_token);
        Self::validate_splits(&payment_split);

        let mut recipient = self
            .recipients
            .get(&recipient_hash)
            .expect("Recipient not found");
        let route_changed = recipient.preferred_chain != preferred_chain
            || recipient.preferred_token != preferred_token
            || recipient.payment_split != payment_split;

        recipient.preferred_chain = preferred_chain;
        recipient.preferred_token = preferred_token;
        recipient.payment_split = payment_split;
        self.recipients.insert(&recipient_hash, &recipient);

        if route_changed {
            self.append_anomaly(
                "RECIPIENT_ROUTE_CHANGED",
                "MEDIUM",
                "A recipient payment route was changed by the owner".to_string(),
            );
        }
    }

    pub fn update_agent(&mut self, new_agent: AccountId) {
        self.assert_owner();
        self.agent = new_agent;
    }

    pub fn get_recipient(&self, recipient_hash: String) -> Option<RecipientView> {
        self.recipients
            .get(&recipient_hash)
            .map(|recipient| Self::recipient_view(recipient_hash, recipient))
    }

    pub fn get_recipients(&self, from: u64, limit: u64) -> Vec<RecipientView> {
        let safe_limit = limit.min(MAX_PAGE_SIZE);
        self.recipients
            .iter()
            .skip(from as usize)
            .take(safe_limit as usize)
            .map(|(hash, recipient)| Self::recipient_view(hash, recipient))
            .collect()
    }

    pub fn get_recipient_count(&self) -> u64 {
        self.recipient_count
    }

    pub fn is_registered(&self, account_id: AccountId) -> bool {
        let account = account_id.to_string().to_lowercase();
        let account_hash = near_sdk::env::sha256(account.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        if self.recipients.get(&account_hash).is_some() {
            return true;
        }

        // Compatibility fallback for early records that included a NEAR
        // account in the display label.
        self.recipients.iter().any(|(_, config)| {
            config.preferred_chain == "near" && config.name.to_lowercase().contains(&account)
        })
    }
}

impl Clavis {
    fn set_recipient_active(&mut self, recipient_hash: String, active: bool) {
        self.assert_owner();
        self.assert_recipient_not_settling(&recipient_hash);
        let mut recipient = self
            .recipients
            .get(&recipient_hash)
            .expect("Recipient not found");
        recipient.active = active;
        self.recipients.insert(&recipient_hash, &recipient);
    }
}
