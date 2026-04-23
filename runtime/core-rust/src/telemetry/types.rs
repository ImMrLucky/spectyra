//! Telemetry DTOs — never include prompts, completions, messages, keys, or raw payloads.

use serde::{Deserialize, Serialize};

/// Mirrors `packages/sdk/src/cloud/postRunTelemetry.ts` body for `POST /v1/telemetry/run`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SdkTelemetryRunPayload {
    pub environment: String,
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub optimized_tokens: u64,
    pub estimated_cost: f64,
    pub optimized_cost: f64,
    pub savings: f64,
    pub diagnostics: SdkProductionDiagnostics,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
}

/// Subset of `SpectyraProductionDiagnostics` (`buildSpectyraProductionDiagnostics.ts`) safe for cloud.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SdkProductionDiagnostics {
    pub provider: String,
    pub run_id: String,
    pub estimated_savings_pct: f64,
    pub transform_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transforms_applied_sample: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountContext {
    pub account_id: Option<String>,
    pub org_id: Option<String>,
    pub app_id: Option<String>,
    pub project_id: Option<String>,
    pub environment: Option<String>,
}
