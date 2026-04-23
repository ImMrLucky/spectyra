use axum::{extract::State, Json};
use serde::Serialize;
use spectyra_core::pricing::ProviderPricingSnapshot;

use crate::state::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PricingMetaResponse {
    pub snapshot_version: Option<String>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub ttl_seconds: Option<u64>,
    pub stale: bool,
}

pub async fn pricing_meta(State(state): State<AppState>) -> Json<PricingMetaResponse> {
    let snap = state.pricing_snapshot.read().await.clone();
    let meta = state.status.read().await.pricing_meta.clone();
    let now = chrono::Utc::now();

    let stale = match &snap {
        Some(s) => s.is_stale(now) || meta.stale,
        None => true,
    };

    let (version, created, ttl) = match snap {
        Some(s) => (Some(s.version), Some(s.created_at), Some(s.ttl_seconds)),
        None => (meta.snapshot_version, meta.created_at, meta.ttl_seconds),
    };

    Json(PricingMetaResponse {
        snapshot_version: version,
        created_at: created,
        ttl_seconds: ttl,
        stale,
    })
}
