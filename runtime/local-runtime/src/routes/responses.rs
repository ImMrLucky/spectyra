use axum::{extract::State, Json};
use spectyra_core::models::ChatRunRequest;

use crate::errors::ApiError;
use crate::services::run_orchestration::{orchestrate_responses, RunChatResponse};
use crate::state::AppState;

pub async fn post_responses_run(
    State(state): State<AppState>,
    Json(req): Json<ChatRunRequest>,
) -> Result<Json<RunChatResponse>, ApiError> {
    let out = orchestrate_responses(state, req).await?;
    Ok(Json(out))
}
