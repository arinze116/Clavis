use near_sdk::json_types::U128;
use near_sdk::{env, near_bindgen, NearToken, Promise};

use crate::{Clavis, ClavisExt};

#[near_bindgen]
impl Clavis {
    pub fn update_limits(&mut self, daily: Option<U128>, per_payment: Option<U128>) {
        self.assert_owner();

        let next_daily = daily.map(|value| value.0).unwrap_or(self.daily_limit);
        let next_per_payment = per_payment
            .map(|value| value.0)
            .unwrap_or(self.per_payment_limit);

        assert!(next_daily > 0, "Daily limit must be greater than zero");
        assert!(
            next_per_payment > 0,
            "Per-payment limit must be greater than zero"
        );
        assert!(
            next_per_payment <= next_daily,
            "Per-payment limit cannot exceed daily limit"
        );
        assert!(
            next_daily >= self.daily_spent,
            "Daily limit cannot be lower than today's authorized spend"
        );

        self.daily_limit = next_daily;
        self.per_payment_limit = next_per_payment;
    }

    pub fn pause(&mut self) {
        self.assert_owner();
        self.paused = true;
    }

    pub fn unpause(&mut self) {
        self.assert_owner();
        self.paused = false;
    }

    pub fn emergency_withdraw(&mut self) -> Promise {
        self.assert_owner();
        self.paused = true;

        // Keep a storage reserve so the contract remains readable after the
        // emergency action. For the capped 20-recipient demo, one NEAR safely
        // covers state rent with substantial headroom.
        let reserve = NearToken::from_near(1);
        let available = env::account_balance().saturating_sub(reserve);
        assert!(!available.is_zero(), "No withdrawable balance");
        Promise::new(self.owner.clone()).transfer(available)
    }

    pub fn get_daily_spent(&self) -> U128 {
        U128(self.daily_spent)
    }

    pub fn get_daily_limit(&self) -> U128 {
        U128(self.daily_limit)
    }

    pub fn get_per_payment_limit(&self) -> U128 {
        U128(self.per_payment_limit)
    }

    pub fn get_treasury_balance(&self) -> U128 {
        U128(env::account_balance().as_yoctonear())
    }

    pub fn get_last_reset_timestamp(&self) -> u64 {
        self.last_reset_timestamp
    }

    pub fn is_paused(&self) -> bool {
        self.paused
    }
}
