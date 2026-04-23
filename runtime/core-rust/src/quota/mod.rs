//! Quota-derived freeze helpers.

use crate::metrics::SessionMetrics;
use crate::models::QuotaState;
use chrono::Utc;

/// Returns true when optimization should halt and metrics should freeze.
pub fn quota_should_freeze(state: QuotaState) -> bool {
    matches!(
        state,
        QuotaState::QuotaExhausted | QuotaState::InactiveDueToQuota | QuotaState::Paused
            | QuotaState::Deleted
            | QuotaState::Disabled
    )
}

pub fn apply_quota_to_session(metrics: &mut SessionMetrics, state: QuotaState) {
    if quota_should_freeze(state) && !metrics.frozen {
        metrics.freeze(Utc::now());
    }
}

pub fn clear_quota_freeze(metrics: &mut SessionMetrics, state: QuotaState) {
    if !quota_should_freeze(state) && metrics.frozen {
        metrics.unfreeze();
    }
}
