use axum::{extract::State, Json};
use spectyra_core::metrics::SessionMetrics;

use crate::state::AppState;

pub async fn session_metrics(State(state): State<AppState>) -> Json<SessionMetrics> {
    Json(state.session_metrics.read().await.clone())
}
