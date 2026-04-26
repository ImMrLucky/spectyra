//! Narrow C ABI for embedding `spectyra_core` from other languages (JSON payloads).
//!
//! Memory: strings returned from `spectyra_*` must be released with `spectyra_free_string`.

use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[no_mangle]
pub extern "C" fn spectyra_free_string(p: *mut c_char) {
    if p.is_null() {
        return;
    }
    unsafe {
        drop(CString::from_raw(p));
    }
}

#[no_mangle]
pub extern "C" fn spectyra_version() -> *mut c_char {
    CString::new(env!("CARGO_PKG_VERSION"))
        .expect("version is valid C string")
        .into_raw()
}

/// JSON body: `{ "baselineUsage": {...}, "optimizedUsage": {...}, "baselineEntry": {...}, "optimizedEntry": {...} }`
/// Returns JSON `{ "ok": true, "savings": {...} }` or `{ "ok": false, "error": "..." }`.
#[no_mangle]
pub extern "C" fn spectyra_calculate_savings_json(input: *const c_char) -> *mut c_char {
    fn err(msg: &str) -> *mut c_char {
        CString::new(
            serde_json::json!({ "ok": false, "error": msg }).to_string(),
        )
        .expect("error json")
        .into_raw()
    }
    if input.is_null() {
        return err("null input");
    }
    let s = unsafe { CStr::from_ptr(input) };
    let text = match s.to_str() {
        Ok(t) => t,
        Err(_) => return err("invalid utf8"),
    };
    let v: serde_json::Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(e) => return err(&format!("json: {e}")),
    };
    let baseline_usage: spectyra_core::NormalizedUsage = match serde_json::from_value(
        v.get("baselineUsage").cloned().unwrap_or(serde_json::Value::Null),
    ) {
        Ok(u) => u,
        Err(e) => return err(&format!("baselineUsage: {e}")),
    };
    let optimized_usage: spectyra_core::NormalizedUsage = match serde_json::from_value(
        v.get("optimizedUsage").cloned().unwrap_or(serde_json::Value::Null),
    ) {
        Ok(u) => u,
        Err(e) => return err(&format!("optimizedUsage: {e}")),
    };
    let baseline_entry: spectyra_core::ModelPricingEntry = match serde_json::from_value(
        v.get("baselineEntry").cloned().unwrap_or(serde_json::Value::Null),
    ) {
        Ok(e) => e,
        Err(e) => return err(&format!("baselineEntry: {e}")),
    };
    let optimized_entry: spectyra_core::ModelPricingEntry = match serde_json::from_value(
        v.get("optimizedEntry").cloned().unwrap_or(serde_json::Value::Null),
    ) {
        Ok(e) => e,
        Err(e) => return err(&format!("optimizedEntry: {e}")),
    };
    match spectyra_core::calculate_savings(
        &baseline_usage,
        &optimized_usage,
        &baseline_entry,
        &optimized_entry,
    ) {
        Ok(s) => CString::new(
            serde_json::json!({ "ok": true, "savings": s }).to_string(),
        )
        .expect("ok json")
        .into_raw(),
        Err(e) => err(&e.to_string()),
    }
}

/// JSON body: `{ "request": ChatRunRequest, "entitlement": { ... }, "sessionFrozen"?: bool }` (camelCase keys).
/// Returns `{ "ok": true, "output": PipelineOutput }` where `output.request` holds optimized messages (local-only).
#[no_mangle]
pub extern "C" fn spectyra_run_chat_pipeline_json(input: *const c_char) -> *mut c_char {
    fn err(msg: &str) -> *mut c_char {
        CString::new(serde_json::json!({ "ok": false, "error": msg }).to_string())
            .expect("error json")
            .into_raw()
    }
    if input.is_null() {
        return err("null input");
    }
    let s = unsafe { CStr::from_ptr(input) };
    let text = match s.to_str() {
        Ok(t) => t,
        Err(_) => return err("invalid utf8"),
    };
    let body: PipelineFfiInput = match serde_json::from_str(text) {
        Ok(b) => b,
        Err(e) => return err(&format!("json: {e}")),
    };
    let ent: spectyra_core::EntitlementStatus = body.entitlement.into();
    match spectyra_core::run_chat_pipeline(body.request, &ent, body.session_frozen) {
        Ok(out) => CString::new(serde_json::json!({ "ok": true, "output": out }).to_string())
            .expect("ok json")
            .into_raw(),
        Err(e) => err(&e.to_string()),
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PipelineFfiInput {
    request: spectyra_core::ChatRunRequest,
    entitlement: FfiEntitlement,
    #[serde(default)]
    session_frozen: bool,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct FfiEntitlement {
    enabled: bool,
    plan: String,
    account_status: String,
    optimization_active: bool,
    quota_state: spectyra_core::QuotaState,
    #[serde(default)]
    refreshed_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    optimized_runs_used: Option<u64>,
    #[serde(default)]
    optimized_runs_limit: Option<u64>,
}

/// Spec alias for {@link spectyra_run_chat_pipeline_json} (same JSON contract).
#[no_mangle]
pub extern "C" fn spectyra_optimize_json(input: *const c_char) -> *mut c_char {
    spectyra_run_chat_pipeline_json(input)
}

impl From<FfiEntitlement> for spectyra_core::EntitlementStatus {
    fn from(e: FfiEntitlement) -> Self {
        Self {
            enabled: e.enabled,
            plan: e.plan,
            account_status: e.account_status,
            optimization_active: e.optimization_active,
            quota_state: e.quota_state,
            refreshed_at: e.refreshed_at.unwrap_or_else(chrono::Utc::now),
            optimized_runs_used: e.optimized_runs_used,
            optimized_runs_limit: e.optimized_runs_limit,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn savings_json_does_not_echo_prompt_content_in_envelope() {
        let payload = serde_json::json!({
            "baselineUsage": { "provider": "openai", "modelId": "gpt-4o", "inputTokens": 1000, "outputTokens": 500 },
            "optimizedUsage": { "provider": "openai", "modelId": "gpt-4o", "inputTokens": 800, "outputTokens": 500 },
            "baselineEntry": {
                "id": "e1", "provider": "openai", "modelId": "gpt-4o",
                "components": [
                    { "key": "input_tokens", "price": 2.5, "unit": "per_1m_tokens", "currency": "USD" },
                    { "key": "output_tokens", "price": 10.0, "unit": "per_1m_tokens", "currency": "USD" }
                ]
            },
            "optimizedEntry": {
                "id": "e1", "provider": "openai", "modelId": "gpt-4o",
                "components": [
                    { "key": "input_tokens", "price": 2.5, "unit": "per_1m_tokens", "currency": "USD" },
                    { "key": "output_tokens", "price": 10.0, "unit": "per_1m_tokens", "currency": "USD" }
                ]
            }
        });
        let cstr = CString::new(payload.to_string()).unwrap();
        let ptr = spectyra_calculate_savings_json(cstr.as_ptr());
        assert!(!ptr.is_null());
        let out = unsafe { CString::from_raw(ptr) };
        let s = out.to_str().unwrap();
        assert!(!s.contains("secret-prompt"));
        assert!(!s.contains("messages"));
        let v: serde_json::Value = serde_json::from_str(s).unwrap();
        assert_eq!(v["ok"], true);
        assert!(v.get("savings").is_some());
    }

    #[test]
    fn pipeline_json_roundtrip() {
        let json = r#"{"request":{"provider":"openai","model":"gpt-4o-mini","messages":[{"role":"user","content":"hello there"}]},"entitlement":{"enabled":true,"plan":"free","accountStatus":"active","optimizationActive":true,"quotaState":"active_free"}}"#;
        let cstr = CString::new(json).unwrap();
        let ptr = spectyra_run_chat_pipeline_json(cstr.as_ptr());
        assert!(!ptr.is_null());
        let out = unsafe { CString::from_raw(ptr) };
        let v: serde_json::Value = serde_json::from_str(out.to_str().unwrap()).unwrap();
        assert_eq!(v["ok"], true);
        assert!(v["output"]["request"]["messages"].is_array());
    }

    #[test]
    fn pipeline_json_envelope_has_no_api_key_echo() {
        let json = r#"{"request":{"provider":"openai","model":"gpt-4o-mini","messages":[{"role":"user","content":"x"}]},"entitlement":{"enabled":true,"plan":"free","accountStatus":"active","optimizationActive":true,"quotaState":"active_free"}}"#;
        let cstr = CString::new(json).unwrap();
        let ptr = spectyra_run_chat_pipeline_json(cstr.as_ptr());
        assert!(!ptr.is_null());
        let s = unsafe { CString::from_raw(ptr) }.to_str().unwrap().to_owned();
        let lower = s.to_lowercase();
        assert!(!lower.contains("x-api-key"));
        assert!(!lower.contains("authorization"));
    }
}
