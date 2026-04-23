use axum::{extract::State, Json};
use spectyra_core::models::EmbeddingsRunRequest;

use crate::errors::ApiError;
use crate::services::run_orchestration::{orchestrate_embeddings, RunEmbeddingsResponse};
use crate::state::AppState;

pub async fn post_embeddings_run(
    State(state): State<AppState>,
    Json(req): Json<EmbeddingsRunRequest>,
) -> Result<Json<RunEmbeddingsResponse>, ApiError> {
    let out = orchestrate_embeddings(state, req).await?;
    Ok(Json(out))
}
