use axum::{extract::State, Json};
use serde::Serialize;
use std::path::PathBuf;

use crate::errors::ApiError;
use crate::state::AppState;

#[derive(Serialize)]
pub struct ReloadBody {
    pub ok: bool,
}

pub async fn reload_config(State(state): State<AppState>) -> Result<Json<ReloadBody>, ApiError> {
    let path = std::env::var("SPECTYRA_RUNTIME_CONFIG")
        .ok()
        .map(PathBuf::from);
    let cfg = crate::config::RuntimeConfig::load(path.as_deref())
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    {
        let mut w = state.config.write().await;
        *w = cfg;
    }

    crate::refresh_provider_env_flags(&state).await;

    Ok(Json(ReloadBody { ok: true }))
}
