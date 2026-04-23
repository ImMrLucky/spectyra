//! Shared orchestration for chat-like runs (locals only — prompts never leave except to provider).

use serde_json::Value;
use spectyra_core::metrics::{RunMetrics, SessionMetrics};
use spectyra_core::models::{
    ChatRunRequest, EmbeddingsRunRequest, NormalizedUsage, ProviderName, QuotaStatus,
};
use spectyra_core::pricing::{
    calculate_savings, resolve_entry, ModelPricingEntry, ProviderPricingSnapshot,
};
use spectyra_core::{
    generate_run_id,
    optimization_allowed,
    run_chat_pipeline,
    sdk_telemetry_run_payload_from_run,
};
use crate::provider::{
    adapter_for, openai_run_responses, ProviderChatRequest, ProviderEmbeddingsRequest,
};
use crate::services::analytics_emitter::{enqueue, telemetry_account_from_metadata};
use crate::state::AppState;

fn baseline_usage_from_request(req: &ChatRunRequest, output_tokens: u64, provider: &ProviderName) -> NormalizedUsage {
    let chars: usize = req.messages.iter().map(|m| m.content.len()).sum();
    let etok = ((chars as u64).saturating_add(3)) / 4;
    NormalizedUsage {
        provider: provider.clone(),
        model_id: req.model.clone(),
        endpoint_class: req.endpoint_class.clone(),
        region: req.region.clone(),
        input_tokens: Some(etok),
        output_tokens: Some(output_tokens),
        cached_input_tokens: None,
        cache_write_tokens: None,
        cache_read_tokens: None,
        thinking_tokens: None,
        reasoning_tokens: None,
        tool_calls: None,
        web_search_calls: None,
        grounded_prompts: None,
        image_inputs: None,
        image_outputs: None,
        audio_input_tokens: None,
        audio_output_tokens: None,
        storage_hours: None,
        batch: None,
        raw_provider_usage: None,
    }
}

pub fn resolve_pricing_entries<'a>(
    snap: Option<&'a ProviderPricingSnapshot>,
    provider: &str,
    model_id: &str,
    warnings: &mut Vec<String>,
) -> Option<&'a ModelPricingEntry> {
    let entries = snap.map(|s| s.entries.as_slice()).unwrap_or(&[]);
    resolve_entry(entries, provider, model_id, warnings)
}

pub fn build_quota_status(
    state: &spectyra_core::models::EntitlementStatus,
    session: &SessionMetrics,
    upgrade_url: Option<String>,
) -> QuotaStatus {
    let used = state.optimized_runs_used;
    let limit = state.optimized_runs_limit;
    let remaining = match (used, limit) {
        (Some(u), Some(l)) => Some(l.saturating_sub(u)),
        _ => None,
    };
    let percent_used = match (used, limit) {
        (Some(u), Some(l)) if l > 0 => Some((u as f64 / l as f64) * 100.0),
        _ => None,
    };

    QuotaStatus {
        plan: state.plan.clone(),
        state: state.quota_state,
        used,
        limit,
        remaining,
        percent_used,
        upgrade_url,
        frozen_at: session.frozen.then(|| session.frozen_at).flatten(),
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunChatResponse {
    pub output: Value,
    pub provider: String,
    pub model: String,
    pub usage: NormalizedUsage,
    pub cost_before: f64,
    pub cost_after: f64,
    pub savings_amount: f64,
    pub savings_percent: f64,
    pub quota_status: QuotaStatus,
    pub optimization_active: bool,
    pub warnings: Vec<String>,
}

pub async fn orchestrate_chat(state: AppState, req: ChatRunRequest) -> Result<RunChatResponse, crate::errors::ApiError> {
    let cfg = state.config.read().await.clone();
    let entitlement = state.entitlement.read().await.clone();
    let snap = state.pricing_snapshot.read().await.clone();
    let frozen = state.session_metrics.read().await.frozen;

    let pipe = run_chat_pipeline(req.clone(), &entitlement, frozen).map_err(|e| {
        crate::errors::ApiError::BadRequest(e.to_string())
    })?;

    let provider_req = ProviderChatRequest {
        model: pipe.request.model.clone(),
        messages: pipe.request.messages.clone(),
        metadata: pipe.request.metadata.clone(),
    };

    let adapter = adapter_for(&cfg, &state.http, &pipe.request.provider).map_err(|e| {
        crate::errors::ApiError::BadRequest(e.to_string())
    })?;

    let started = std::time::Instant::now();
    let chat_res = adapter.run_chat(provider_req).await.map_err(|e| {
        crate::errors::ApiError::Provider(e.to_string())
    })?;
    let latency = started.elapsed().as_millis() as u64;

    let mut warnings = pipe.warnings.clone();
    let mut pricing_warnings = Vec::new();

    let baseline_usage = baseline_usage_from_request(
        &req,
        chat_res.usage.output_tokens.unwrap_or(0),
        &pipe.request.provider,
    );
    let optimized_usage = chat_res.usage.clone();

    let prov_str = pipe.request.provider.as_str();
    let entry_base = resolve_pricing_entries(snap.as_ref(), prov_str, &req.model, &mut pricing_warnings);
    let entry_opt = resolve_pricing_entries(snap.as_ref(), prov_str, &optimized_usage.model_id, &mut pricing_warnings);

    warnings.extend(pricing_warnings);

    let (cost_before, cost_after, savings_amount, savings_percent) =
        match (entry_base, entry_opt) {
            (Some(b), Some(o)) => match calculate_savings(&baseline_usage, &optimized_usage, b, o) {
                Ok(s) => (
                    s.baseline.total,
                    s.optimized.total,
                    s.savings_amount,
                    s.savings_percent,
                ),
                Err(e) => {
                    warnings.push(e.to_string());
                    (0.0, 0.0, 0.0, 0.0)
                }
            },
            _ => {
                warnings.push(
                    "pricing entry missing — cost/savings unavailable until snapshot/model resolves".into(),
                );
                (0.0, 0.0, 0.0, 0.0)
            }
        };

    let opt_active = pipe.optimization_applied && optimization_allowed(&entitlement);

    let run_id = req
        .request_id
        .clone()
        .unwrap_or_else(generate_run_id);

    let run = RunMetrics {
        provider: pipe.request.provider.as_str().to_string(),
        model_id: req.model.clone(),
        run_id,
        input_tokens_before: baseline_usage.input_tokens,
        output_tokens_before: baseline_usage.output_tokens,
        input_tokens_after: optimized_usage.input_tokens,
        output_tokens_after: optimized_usage.output_tokens,
        cost_before,
        cost_after,
        savings_amount,
        savings_percent,
        latency_ms: Some(latency),
        transform_names: pipe.transform_names.clone(),
        quota_state_at_run: entitlement.quota_state,
    };

    if !frozen {
        let mut sm = state.session_metrics.write().await;
        sm.apply_run(&run);
    }

    let sess = state.session_metrics.read().await.clone();
    let upgrade = state.status.read().await.upgrade_url.clone();

    let evt = sdk_telemetry_run_payload_from_run(
        &telemetry_account_from_metadata(req.metadata.as_ref()),
        &run,
    );

    if cfg.analytics_enabled {
        enqueue(&state, evt).await;
    }

    let quota_status = build_quota_status(&entitlement, &sess, upgrade);

    Ok(RunChatResponse {
        output: chat_res.output,
        provider: pipe.request.provider.as_str().to_string(),
        model: pipe.request.model,
        usage: optimized_usage,
        cost_before,
        cost_after,
        savings_amount,
        savings_percent,
        quota_status,
        optimization_active: opt_active,
        warnings,
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunEmbeddingsResponse {
    pub embeddings: Vec<Vec<f64>>,
    pub provider: String,
    pub model: String,
    pub usage: NormalizedUsage,
    pub cost_before: f64,
    pub cost_after: f64,
    pub savings_amount: f64,
    pub savings_percent: f64,
    pub quota_status: QuotaStatus,
    pub optimization_active: bool,
    pub warnings: Vec<String>,
}

pub async fn orchestrate_embeddings(
    state: AppState,
    req: EmbeddingsRunRequest,
) -> Result<RunEmbeddingsResponse, crate::errors::ApiError> {
    let cfg = state.config.read().await.clone();
    let entitlement = state.entitlement.read().await.clone();
    let snap = state.pricing_snapshot.read().await.clone();

    let adapter = adapter_for(&cfg, &state.http, &req.provider).map_err(|e| {
        crate::errors::ApiError::BadRequest(e.to_string())
    })?;

    let started = std::time::Instant::now();
    let er = adapter
        .run_embeddings(ProviderEmbeddingsRequest {
            model: req.model.clone(),
            input: req.input.clone(),
        })
        .await
        .map_err(|e| crate::errors::ApiError::Provider(e.to_string()))?;
    let _latency = started.elapsed().as_millis() as u64;

    let mut warnings = Vec::new();
    let chars: u64 = req.input.iter().map(|s| s.len() as u64).sum();
    let baseline_tok = (chars.saturating_add(3)) / 4;
    let base_u = NormalizedUsage {
        provider: req.provider.clone(),
        model_id: req.model.clone(),
        endpoint_class: req.endpoint_class.clone(),
        region: req.region.clone(),
        input_tokens: Some(baseline_tok),
        output_tokens: Some(0),
        cached_input_tokens: None,
        cache_write_tokens: None,
        cache_read_tokens: None,
        thinking_tokens: None,
        reasoning_tokens: None,
        tool_calls: None,
        web_search_calls: None,
        grounded_prompts: None,
        image_inputs: None,
        image_outputs: None,
        audio_input_tokens: None,
        audio_output_tokens: None,
        storage_hours: None,
        batch: None,
        raw_provider_usage: None,
    };

    let prov = req.provider.as_str();
    let eb = resolve_pricing_entries(snap.as_ref(), prov, &req.model, &mut warnings);
    let eo = resolve_pricing_entries(snap.as_ref(), prov, &er.usage.model_id, &mut warnings);

    let (cost_before, cost_after, savings_amount, savings_percent) = match (eb, eo) {
        (Some(b), Some(o)) => match calculate_savings(&base_u, &er.usage, b, o) {
            Ok(s) => (
                s.baseline.total,
                s.optimized.total,
                s.savings_amount,
                s.savings_percent,
            ),
            Err(e) => {
                warnings.push(e.to_string());
                (0.0, 0.0, 0.0, 0.0)
            }
        },
        _ => (0.0, 0.0, 0.0, 0.0),
    };

    let frozen = state.session_metrics.read().await.frozen;

    let run_id = req
        .request_id
        .clone()
        .unwrap_or_else(generate_run_id);

    let run = RunMetrics {
        provider: req.provider.as_str().to_string(),
        model_id: req.model.clone(),
        run_id,
        input_tokens_before: base_u.input_tokens,
        output_tokens_before: Some(0),
        input_tokens_after: er.usage.input_tokens,
        output_tokens_after: er.usage.output_tokens,
        cost_before,
        cost_after,
        savings_amount,
        savings_percent,
        latency_ms: None,
        transform_names: vec![],
        quota_state_at_run: entitlement.quota_state,
    };

    if !frozen {
        let mut sm = state.session_metrics.write().await;
        sm.apply_run(&run);
    }

    let evt = sdk_telemetry_run_payload_from_run(
        &telemetry_account_from_metadata(req.metadata.as_ref()),
        &run,
    );
    if cfg.analytics_enabled {
        enqueue(&state, evt).await;
    }

    let sess = state.session_metrics.read().await.clone();
    let upgrade = state.status.read().await.upgrade_url.clone();

    Ok(RunEmbeddingsResponse {
        embeddings: er.embeddings,
        provider: req.provider.as_str().to_string(),
        model: req.model,
        usage: er.usage,
        cost_before,
        cost_after,
        savings_amount,
        savings_percent,
        quota_status: build_quota_status(&entitlement, &sess, upgrade),
        optimization_active: optimization_allowed(&entitlement),
        warnings,
    })
}

pub async fn orchestrate_responses(
    state: AppState,
    req: ChatRunRequest,
) -> Result<RunChatResponse, crate::errors::ApiError> {
    if req.provider != ProviderName::OpenAI {
        return Err(crate::errors::ApiError::BadRequest(
            "responses API is only wired for OpenAI in this runtime".into(),
        ));
    }
    let cfg = state.config.read().await.clone();
    let key = crate::config::resolve_provider_api_key(&cfg, &ProviderName::OpenAI).map_err(|e| {
        crate::errors::ApiError::BadRequest(e)
    })?;

    let entitlement = state.entitlement.read().await.clone();
    let snap = state.pricing_snapshot.read().await.clone();
    let frozen = state.session_metrics.read().await.frozen;

    let pipe = run_chat_pipeline(req.clone(), &entitlement, frozen).map_err(|e| {
        crate::errors::ApiError::BadRequest(e.to_string())
    })?;

    let started = std::time::Instant::now();
    let (output, optimized_usage) =
        openai_run_responses(&state.http, &key, &pipe.request.model, &pipe.request.messages)
            .await
            .map_err(|e| crate::errors::ApiError::Provider(e.to_string()))?;
    let latency = started.elapsed().as_millis() as u64;

    let mut warnings = pipe.warnings.clone();
    let mut pw = Vec::new();

    let baseline_usage = baseline_usage_from_request(
        &req,
        optimized_usage.output_tokens.unwrap_or(0),
        &pipe.request.provider,
    );

    let prov_str = pipe.request.provider.as_str();
    let eb = resolve_pricing_entries(snap.as_ref(), prov_str, &req.model, &mut pw);
    let eo = resolve_pricing_entries(snap.as_ref(), prov_str, &optimized_usage.model_id, &mut pw);
    warnings.extend(pw);

    let (cost_before, cost_after, savings_amount, savings_percent) = match (eb, eo) {
        (Some(b), Some(o)) => match calculate_savings(&baseline_usage, &optimized_usage, b, o) {
            Ok(s) => (
                s.baseline.total,
                s.optimized.total,
                s.savings_amount,
                s.savings_percent,
            ),
            Err(e) => {
                warnings.push(e.to_string());
                (0.0, 0.0, 0.0, 0.0)
            }
        },
        _ => (0.0, 0.0, 0.0, 0.0),
    };

    let opt_active = pipe.optimization_applied && optimization_allowed(&entitlement);

    let run_id = req
        .request_id
        .clone()
        .unwrap_or_else(generate_run_id);

    let run = RunMetrics {
        provider: prov_str.to_string(),
        model_id: req.model.clone(),
        run_id,
        input_tokens_before: baseline_usage.input_tokens,
        output_tokens_before: baseline_usage.output_tokens,
        input_tokens_after: optimized_usage.input_tokens,
        output_tokens_after: optimized_usage.output_tokens,
        cost_before,
        cost_after,
        savings_amount,
        savings_percent,
        latency_ms: Some(latency),
        transform_names: pipe.transform_names.clone(),
        quota_state_at_run: entitlement.quota_state,
    };

    if !frozen {
        let mut sm = state.session_metrics.write().await;
        sm.apply_run(&run);
    }

    let sess = state.session_metrics.read().await.clone();
    let upgrade = state.status.read().await.upgrade_url.clone();

    let evt = sdk_telemetry_run_payload_from_run(
        &telemetry_account_from_metadata(req.metadata.as_ref()),
        &run,
    );
    if cfg.analytics_enabled {
        enqueue(&state, evt).await;
    }

    Ok(RunChatResponse {
        output,
        provider: prov_str.to_string(),
        model: pipe.request.model,
        usage: optimized_usage,
        cost_before,
        cost_after,
        savings_amount,
        savings_percent,
        quota_status: build_quota_status(&entitlement, &sess, upgrade),
        optimization_active: opt_active,
        warnings,
    })
}
