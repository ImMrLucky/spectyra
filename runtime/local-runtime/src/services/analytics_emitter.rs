//! Batched Privacy-safe telemetry POST (`POST /v1/telemetry/run`). Never blocks caller for long.

use std::time::Duration;

use spectyra_core::telemetry::{AccountContext, SdkTelemetryRunPayload};
use tracing::warn;

use crate::state::AppState;

pub async fn enqueue(state: &AppState, ev: SdkTelemetryRunPayload) {
    let mut q = state.analytics_queue.write().await;
    q.push(ev);
}

pub async fn flush_once(state: &AppState) -> Result<(), String> {
    let cfg = state.config.read().await;
    if !cfg.analytics_enabled {
        return Ok(());
    }
    let api_key = match cfg.resolve_account_api_key() {
        Some(k) => k,
        None => return Ok(()),
    };
    let base = cfg.account_api_base.trim_end_matches('/').to_string();
    drop(cfg);

    let drained: Vec<SdkTelemetryRunPayload> = {
        let mut q = state.analytics_queue.write().await;
        if q.is_empty() {
            return Ok(());
        }
        q.drain(..).collect()
    };

    let mut failed = Vec::new();
    let client = state.http.clone();

    for ev in drained {
        let url = format!("{}/telemetry/run", base);
        let res = client
            .post(&url)
            .header("X-SPECTYRA-API-KEY", &api_key)
            .header("Content-Type", "application/json")
            .json(&ev)
            .send()
            .await;

        match res {
            Ok(r) if r.status().is_success() => {}
            Ok(r) => {
                warn!(status = %r.status(), "analytics POST rejected");
                failed.push(ev);
            }
            Err(e) => {
                warn!(error = %e, "analytics POST transport");
                failed.push(ev);
            }
        }
    }

    if !failed.is_empty() {
        let mut q = state.analytics_queue.write().await;
        q.extend(failed);
        return Err("analytics partial failure".into());
    }

    Ok(())
}

pub async fn flush_with_backoff(state: &AppState) {
    let mut delay = Duration::from_secs(1);
    for _ in 0..5 {
        match flush_once(state).await {
            Ok(()) => return,
            Err(_) => {
                tokio::time::sleep(delay).await;
                delay = (delay * 2).min(Duration::from_secs(60));
            }
        }
    }
    warn!("analytics flush dropped after retries (queue may retain items)");
}

pub fn spawn_emitter_loop(state: AppState) {
    tokio::spawn(async move {
        let mut iv = tokio::time::interval(Duration::from_secs(30));
        loop {
            iv.tick().await;
            flush_with_backoff(&state).await;
        }
    });
}

pub fn telemetry_account_from_metadata(meta: Option<&serde_json::Value>) -> AccountContext {
    let empty = serde_json::Value::Null;
    let m = meta.unwrap_or(&empty);
    AccountContext {
        account_id: m.get("accountId").and_then(|x| x.as_str()).map(String::from),
        org_id: m.get("orgId").and_then(|x| x.as_str()).map(String::from),
        app_id: m.get("appId").and_then(|x| x.as_str()).map(String::from),
        project_id: m
            .get("projectId")
            .or_else(|| m.get("project"))
            .and_then(|x| x.as_str())
            .map(String::from),
        environment: m.get("environment").and_then(|x| x.as_str()).map(String::from),
    }
}
