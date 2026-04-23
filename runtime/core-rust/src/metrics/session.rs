//! In-process session rollup with quota freeze semantics.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::models::QuotaState;

/// Aggregate metrics from a single completed optimization run (no prompt/completion payloads).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunMetrics {
    pub provider: String,
    pub model_id: String,
    /// Correlates with `diagnostics.runId` on `POST /v1/telemetry/run`.
    pub run_id: String,
    pub input_tokens_before: Option<u64>,
    pub output_tokens_before: Option<u64>,
    pub input_tokens_after: Option<u64>,
    pub output_tokens_after: Option<u64>,
    pub cost_before: f64,
    pub cost_after: f64,
    pub savings_amount: f64,
    pub savings_percent: f64,
    pub latency_ms: Option<u64>,
    pub transform_names: Vec<String>,
    pub quota_state_at_run: QuotaState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMetrics {
    pub total_requests: u64,
    pub total_cost_before: f64,
    pub total_cost_after: f64,
    pub total_savings_amount: f64,
    pub total_savings_percent: f64,
    pub frozen: bool,
    pub frozen_at: Option<DateTime<Utc>>,
    pub last_run_summary: Option<RunMetrics>,
}

impl Default for SessionMetrics {
    fn default() -> Self {
        Self {
            total_requests: 0,
            total_cost_before: 0.0,
            total_cost_after: 0.0,
            total_savings_amount: 0.0,
            total_savings_percent: 0.0,
            frozen: false,
            frozen_at: None,
            last_run_summary: None,
        }
    }
}

impl SessionMetrics {
    pub fn apply_run(&mut self, run: &RunMetrics) {
        if self.frozen {
            return;
        }
        self.total_requests = self.total_requests.saturating_add(1);
        self.total_cost_before += run.cost_before;
        self.total_cost_after += run.cost_after;
        self.total_savings_amount += run.savings_amount;

        let n = self.total_requests as f64;
        self.total_savings_percent = if self.total_cost_before > 0.0 {
            ((self.total_cost_before - self.total_cost_after) / self.total_cost_before) * 100.0
        } else if n > 0.0 {
            self.total_savings_percent * ((n - 1.0) / n) + run.savings_percent / n
        } else {
            run.savings_percent
        };

        self.last_run_summary = Some(run.clone());
    }

    pub fn freeze(&mut self, now: DateTime<Utc>) {
        self.frozen = true;
        self.frozen_at = Some(now);
    }

    pub fn unfreeze(&mut self) {
        self.frozen = false;
        self.frozen_at = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_run() -> RunMetrics {
        RunMetrics {
            provider: "openai".into(),
            model_id: "gpt-4o".into(),
            run_id: "test-run".into(),
            input_tokens_before: Some(100),
            output_tokens_before: Some(50),
            input_tokens_after: Some(80),
            output_tokens_after: Some(50),
            cost_before: 1.0,
            cost_after: 0.8,
            savings_amount: 0.2,
            savings_percent: 20.0,
            latency_ms: Some(120),
            transform_names: vec!["noop".into()],
            quota_state_at_run: QuotaState::ActivePaid,
        }
    }

    #[test]
    fn freeze_blocks_updates() {
        let mut s = SessionMetrics::default();
        let r = sample_run();
        s.apply_run(&r);
        assert_eq!(s.total_requests, 1);
        s.freeze(Utc::now());
        s.apply_run(&r);
        assert_eq!(s.total_requests, 1);
    }

    #[test]
    fn unfreeze_allows_updates() {
        let mut s = SessionMetrics::default();
        let r = sample_run();
        s.freeze(Utc::now());
        s.unfreeze();
        s.apply_run(&r);
        assert_eq!(s.total_requests, 1);
    }
}
