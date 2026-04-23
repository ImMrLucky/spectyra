use axum::{extract::State, Json};
use spectyra_core::models::ChatRunRequest;

use crate::errors::ApiError;
use crate::services::run_orchestration::{orchestrate_chat, RunChatResponse};
use crate::state::AppState;

pub async fn post_run_chat(
    State(state): State<AppState>,
    Json(req): Json<ChatRunRequest>,
) -> Result<Json<RunChatResponse>, ApiError> {
    let out = orchestrate_chat(state, req).await?;
    Ok(Json(out))
}
