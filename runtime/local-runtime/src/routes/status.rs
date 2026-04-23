use axum::{extract::State, Json};
use serde::Serialize;
use spectyra_core::pricing::ProviderPricingSnapshot;

use crate::constants::runtime_version;
use crate::state::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub runtime_version: String,
    pub bind_address: String,
    pub analytics_enabled: bool,
    pub pricing_snapshot_version: Option<String>,
    pub pricing_snapshot_fetched_at: Option<chrono::DateTime<chrono::Utc>>,
    pub pricing_stale: bool,
    pub entitlement_refreshed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub entitlement_last_error: Option<String>,
    pub providers_available: std::collections::HashMap<String, bool>,
}

pub async fn status(State(state): State<AppState>) -> Json<StatusResponse> {
    let cfg = state.config.read().await.clone();
    let snap = state.pricing_snapshot.read().await.clone();
    let st = state.status.read().await.clone();

    let now = chrono::Utc::now();
    let pricing_stale = snap
        .as_ref()
        .map(|s: &ProviderPricingSnapshot| s.is_stale(now))
        .unwrap_or(true);

    Json(StatusResponse {
        runtime_version: runtime_version().to_string(),
        bind_address: cfg.bind.clone(),
        analytics_enabled: cfg.analytics_enabled,
        pricing_snapshot_version: snap.as_ref().map(|s| s.version.clone()),
        pricing_snapshot_fetched_at: snap.as_ref().map(|s| s.fetched_at),
        pricing_stale,
        entitlement_refreshed_at: st.entitlement_last_refresh,
        entitlement_last_error: st.entitlement_last_error,
        providers_available: st.providers_available,
    })
}
