//! `GET /v1/entitlements/status` against Spectyra cloud (account key only — no prompts).

use chrono::Utc;
use serde::Deserialize;
use spectyra_core::metrics::SessionMetrics;
use spectyra_core::models::{EntitlementStatus, QuotaState};
use spectyra_core::quota::{apply_quota_to_session, clear_quota_freeze};
use tracing::warn;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntitlementsBody {
    org_id: String,
    entitlement: EntitlementPayload,
    can_run_optimized: bool,
    savings_observe_only: bool,
    upgrade_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntitlementPayload {
    plan: String,
    #[allow(dead_code)]
    trial_state: Option<serde_json::Value>,
    #[allow(dead_code)]
    trial_ends_at: Option<String>,
    license_status: String,
    optimized_runs_limit: Option<u64>,
    optimized_runs_used: u64,
    #[allow(dead_code)]
    cloud_analytics_enabled: bool,
    #[allow(dead_code)]
    desktop_app_enabled: bool,
    sdk_enabled: bool,
}

fn derive_quota_state(
    e: &EntitlementPayload,
    can_run: bool,
    _observe_only: bool,
) -> QuotaState {
    if !e.sdk_enabled {
        return QuotaState::Disabled;
    }
    if let Some(limit) = e.optimized_runs_limit {
        if e.optimized_runs_used >= limit {
            return QuotaState::QuotaExhausted;
        }
    }
    if !can_run {
        return QuotaState::InactiveDueToQuota;
    }
    let percent = match e.optimized_runs_limit {
        Some(l) if l > 0 => Some((e.optimized_runs_used as f64 / l as f64) * 100.0),
        _ => None,
    };
    if let Some(p) = percent {
        if p >= 80.0 {
            return QuotaState::ApproachingLimit;
        }
    }
    if e.plan == "free" {
        QuotaState::ActiveFree
    } else {
        QuotaState::ActivePaid
    }
}

fn to_status(
    body: &EntitlementsBody,
    refreshed_at: chrono::DateTime<Utc>,
) -> EntitlementStatus {
    let e = &body.entitlement;
    let qs = derive_quota_state(e, body.can_run_optimized, body.savings_observe_only);
    EntitlementStatus {
        enabled: e.sdk_enabled,
        plan: e.plan.clone(),
        account_status: e.license_status.clone(),
        optimization_active: body.can_run_optimized && e.sdk_enabled,
        quota_state: qs,
        refreshed_at,
        optimized_runs_used: Some(e.optimized_runs_used),
        optimized_runs_limit: e.optimized_runs_limit,
    }
}

pub async fn refresh_once(state: &AppState) {
    let (url, api_key) = {
        let cfg = state.config.read().await;
        let key = match cfg.resolve_account_api_key() {
            Some(k) => k,
            None => {
                let mut st = state.status.write().await;
                st.entitlement_last_error =
                    Some("missing SPECTYRA account API key env".into());
                return;
            }
        };
        let u = format!(
            "{}/entitlements/status",
            cfg.account_api_base.trim_end_matches('/')
        );
        (u, key)
    };

    let res = match state
        .http
        .get(&url)
        .header("X-SPECTYRA-API-KEY", api_key)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "entitlement refresh transport");
            let mut st = state.status.write().await;
            st.entitlement_last_error = Some(e.to_string());
            return;
        }
    };

    let status = res.status();
    if !status.is_success() {
        let txt = res.text().await.unwrap_or_default();
        warn!(%txt, %status, "entitlement refresh http");
        let mut st = state.status.write().await;
        st.entitlement_last_error = Some(format!("HTTP {}", status));
        return;
    }

    let parsed: Result<EntitlementsBody, _> = res.json().await;
    let body = match parsed {
        Ok(b) => b,
        Err(e) => {
            warn!(error = %e, "entitlement json");
            let mut st = state.status.write().await;
            st.entitlement_last_error = Some(e.to_string());
            return;
        }
    };

    let now = Utc::now();
    let next = to_status(&body, now);

    {
        let mut ent = state.entitlement.write().await;
        *ent = next.clone();
    }

    {
        let mut st = state.status.write().await;
        st.entitlement_last_refresh = Some(now);
        st.entitlement_last_error = None;
        st.upgrade_url = body.upgrade_url.clone();
    }

    sync_session_freeze(state).await;
}

async fn sync_session_freeze(state: &AppState) {
    let ent = state.entitlement.read().await.clone();
    let mut sm = state.session_metrics.write().await;
    sync_session_freeze_inner(&ent, &mut sm);
}

pub fn sync_session_freeze_inner(ent: &EntitlementStatus, sm: &mut SessionMetrics) {
    if spectyra_core::quota::quota_should_freeze(ent.quota_state) {
        apply_quota_to_session(sm, ent.quota_state);
    } else {
        clear_quota_freeze(sm, ent.quota_state);
    }
}

pub fn spawn_entitlement_loop(state: AppState, interval_secs: u64) {
    tokio::spawn(async move {
        let mut iv = tokio::time::interval(std::time::Duration::from_secs(interval_secs.max(10)));
        loop {
            iv.tick().await;
            refresh_once(&state).await;
        }
    });
}
