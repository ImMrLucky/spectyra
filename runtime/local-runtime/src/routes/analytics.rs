use axum::{extract::State, Json};
use serde::Serialize;

use crate::errors::ApiError;
use crate::services::analytics_emitter::flush_with_backoff;
use crate::state::AppState;

#[derive(Serialize)]
pub struct FlushBody {
    pub ok: bool,
}

pub async fn flush_analytics(
    State(state): State<AppState>,
) -> Result<Json<FlushBody>, ApiError> {
    flush_with_backoff(&state).await;
    Ok(Json(FlushBody { ok: true }))
}
