use near_sdk::{env, near_bindgen};

use crate::types::{AnomalyEntry, AuditEntry, PaymentOutcome};
use crate::{Clavis, ClavisExt, ANOMALY_COOLDOWN_NS, MAX_PAGE_SIZE};

impl Clavis {
    pub(crate) fn append_audit(&mut self, outcome: PaymentOutcome) -> u64 {
        self.log_counter = self.log_counter.saturating_add(1);
        let entry = AuditEntry {
            payment_id: self.log_counter,
            timestamp: env::block_timestamp(),
            outcome,
            block_height: env::block_height(),
        };
        self.audit_log.push(&entry);

        // The event deliberately contains no amount, recipient, or route.
        let event = near_sdk::serde_json::json!({
            "standard": "clavis",
            "version": "1.0.0",
            "event": "payment_decision",
            "data": [entry],
        });
        env::log_str(&format!("EVENT_JSON:{event}"));
        self.log_counter
    }

    pub(crate) fn append_anomaly(
        &mut self,
        anomaly_type: &str,
        severity: &str,
        description: String,
    ) -> u64 {
        let now = env::block_timestamp();
        let anomaly_key = anomaly_type.to_string();
        if let Some(previous) = self.anomaly_last_logged.get(&anomaly_key) {
            if now.saturating_sub(previous) < ANOMALY_COOLDOWN_NS {
                return self.anomaly_counter;
            }
        }

        self.anomaly_counter = self.anomaly_counter.saturating_add(1);
        let entry = AnomalyEntry {
            anomaly_id: self.anomaly_counter,
            timestamp: now,
            anomaly_type: anomaly_key.clone(),
            severity: severity.to_string(),
            description,
            reviewed: false,
        };
        self.anomaly_log.push(&entry);
        self.anomaly_last_logged.insert(&anomaly_key, &now);

        let event = near_sdk::serde_json::json!({
            "standard": "clavis",
            "version": "1.0.0",
            "event": "anomaly_detected",
            "data": [entry],
        });
        env::log_str(&format!("EVENT_JSON:{event}"));
        self.anomaly_counter
    }
}

#[near_bindgen]
impl Clavis {
    pub fn get_audit_log(&self, from: u64, limit: u64) -> Vec<AuditEntry> {
        let end = from
            .saturating_add(limit.min(MAX_PAGE_SIZE))
            .min(self.audit_log.len());
        (from.min(self.audit_log.len())..end)
            .filter_map(|index| self.audit_log.get(index))
            .collect()
    }

    pub fn get_audit_log_reverse(&self, from: u64, limit: u64) -> Vec<AuditEntry> {
        let safe_limit = limit.min(MAX_PAGE_SIZE);
        let len = self.audit_log.len();
        let exclusive_end = len.saturating_sub(from.min(len));
        let inclusive_start = exclusive_end.saturating_sub(safe_limit);

        (inclusive_start..exclusive_end)
            .rev()
            .filter_map(|index| self.audit_log.get(index))
            .collect()
    }

    pub fn get_log_count(&self) -> u64 {
        self.log_counter
    }

    pub fn get_anomalies(&self, from: u64, limit: u64, active_only: bool) -> Vec<AnomalyEntry> {
        let safe_limit = limit.min(MAX_PAGE_SIZE) as usize;
        self.anomaly_log
            .iter()
            .skip(from as usize)
            .filter(|entry| !active_only || !entry.reviewed)
            .take(safe_limit)
            .collect()
    }

    pub fn get_anomaly_count(&self) -> u64 {
        self.anomaly_counter
    }

    pub fn dismiss_anomaly(&mut self, anomaly_id: u64) {
        self.assert_owner();
        assert!(anomaly_id > 0, "Invalid anomaly ID");
        let index = anomaly_id - 1;
        let mut entry = self.anomaly_log.get(index).expect("Anomaly not found");
        entry.reviewed = true;
        self.anomaly_log.replace(index, &entry);
    }
}
