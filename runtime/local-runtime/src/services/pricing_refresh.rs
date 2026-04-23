//! `GET /v1/pricing/snapshot` (control plane; no customer inference data).

use chrono::Utc;
use serde::Deserialize;
use spectyra_core::pricing::ProviderPricingSnapshot;
use tracing::warn;

use crate::config::PricingMeta;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PricingApiResponse {
    version: String,
    created_at: chrono::DateTime<chrono::Utc>,
    ttl_seconds: u64,
    entries: Vec<spectyra_core::pricing::ModelPricingEntry>,
}

pub async fn refresh_once(state: &AppState) {
    let (url, key) = {
        let cfg = state.config.read().await;
        let key = match cfg.resolve_account_api_key() {
            Some(k) => k,
            None => return,
        };
        let u = format!(
            "{}/pricing/snapshot",
            cfg.account_api_base.trim_end_matches('/')
        );
        (u, key)
    };

    let res = match state
        .http
        .get(&url)
        .header("X-SPECTYRA-API-KEY", key)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "pricing refresh transport");
            let mut st = state.status.write().await;
            st.pricing_meta.stale = true;
            return;
        }
    };

    let status = res.status();
    if status == 404 {
        warn!("pricing snapshot not available (404) — using last known or empty");
        let mut st = state.status.write().await;
        st.pricing_meta.stale = true;
        return;
    }
    if !status.is_success() {
        let txt = res.text().await.unwrap_or_default();
        warn!(%txt, %status, "pricing refresh");
        let mut st = state.status.write().await;
        st.pricing_meta.stale = true;
        return;
    }

    let body: Result<PricingApiResponse, _> = res.json().await;
    let body = match body {
        Ok(b) => b,
        Err(e) => {
            warn!(error = %e, "pricing json");
            let mut st = state.status.write().await;
            st.pricing_meta.stale = true;
            return;
        }
    };

    let now = Utc::now();
    let snap = ProviderPricingSnapshot {
        version: body.version.clone(),
        created_at: body.created_at,
        ttl_seconds: body.ttl_seconds,
        fetched_at: now,
        entries: body.entries,
    };

    {
        let mut p = state.pricing_snapshot.write().await;
        *p = Some(snap);
    }

    {
        let mut st = state.status.write().await;
        st.pricing_meta = PricingMeta {
            snapshot_version: Some(body.version),
            created_at: Some(body.created_at),
            ttl_seconds: Some(body.ttl_seconds),
            stale: false,
        };
    }
}

pub fn spawn_pricing_loop(state: AppState, interval_secs: u64) {
    tokio::spawn(async move {
        let mut iv = tokio::time::interval(std::time::Duration::from_secs(interval_secs.max(30)));
        loop {
            iv.tick().await;
            refresh_once(&state).await;
        }
    });
}
