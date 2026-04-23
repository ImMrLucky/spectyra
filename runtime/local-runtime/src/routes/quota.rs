use axum::{extract::State, Json};
use spectyra_core::models::QuotaStatus;

use crate::services::run_orchestration::build_quota_status;
use crate::state::AppState;

pub async fn quota(State(state): State<AppState>) -> Json<QuotaStatus> {
    let ent = state.entitlement.read().await.clone();
    let sess = state.session_metrics.read().await.clone();
    let upgrade = state.status.read().await.upgrade_url.clone();
    Json(build_quota_status(&ent, &sess, upgrade))
}
