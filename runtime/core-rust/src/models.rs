//! Domain models. Request/completion types are separate from telemetry DTOs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderName {
    OpenAI,
    Anthropic,
    Google,
    Xai,
    Mistral,
    Groq,
    OpenRouter,
    #[serde(untagged)]
    Custom(String),
}

impl ProviderName {
    pub fn as_str(&self) -> &str {
        match self {
            ProviderName::OpenAI => "openai",
            ProviderName::Anthropic => "anthropic",
            ProviderName::Google => "google",
            ProviderName::Xai => "xai",
            ProviderName::Mistral => "mistral",
            ProviderName::Groq => "groq",
            ProviderName::OpenRouter => "openrouter",
            ProviderName::Custom(s) => s.as_str(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EndpointClass {
    Global,
    Regional,
    MultiRegion,
    FirstParty,
    ThirdParty,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRunRequest {
    pub request_id: Option<String>,
    pub provider: ProviderName,
    pub model: String,
    pub endpoint_class: Option<EndpointClass>,
    pub region: Option<String>,
    pub messages: Vec<Message>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingsRunRequest {
    pub request_id: Option<String>,
    pub provider: ProviderName,
    pub model: String,
    pub endpoint_class: Option<EndpointClass>,
    pub region: Option<String>,
    pub input: Vec<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedUsage {
    pub provider: ProviderName,
    pub model_id: String,
    pub endpoint_class: Option<EndpointClass>,
    pub region: Option<String>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cached_input_tokens: Option<u64>,
    pub cache_write_tokens: Option<u64>,
    pub cache_read_tokens: Option<u64>,
    pub thinking_tokens: Option<u64>,
    pub reasoning_tokens: Option<u64>,
    pub tool_calls: Option<u64>,
    pub web_search_calls: Option<u64>,
    pub grounded_prompts: Option<u64>,
    pub image_inputs: Option<u64>,
    pub image_outputs: Option<u64>,
    pub audio_input_tokens: Option<u64>,
    pub audio_output_tokens: Option<u64>,
    pub storage_hours: Option<u64>,
    pub batch: Option<bool>,
    pub raw_provider_usage: Option<Value>,
    #[serde(default)]
    pub cost_source_override: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuotaState {
    ActiveFree,
    ApproachingLimit,
    QuotaExhausted,
    ActivePaid,
    InactiveDueToQuota,
    Paused,
    Deleted,
    Disabled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaStatus {
    pub plan: String,
    pub state: QuotaState,
    pub used: Option<u64>,
    pub limit: Option<u64>,
    pub remaining: Option<u64>,
    pub percent_used: Option<f64>,
    pub upgrade_url: Option<String>,
    pub frozen_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitlementStatus {
    pub enabled: bool,
    pub plan: String,
    pub account_status: String,
    pub optimization_active: bool,
    pub quota_state: QuotaState,
    pub refreshed_at: DateTime<Utc>,
    pub optimized_runs_used: Option<u64>,
    pub optimized_runs_limit: Option<u64>,
}

impl EntitlementStatus {
    /// Used before the first successful cloud refresh (local-first BYOK still works).
    pub fn offline_default() -> Self {
        Self {
            enabled: true,
            plan: "free".into(),
            account_status: "unknown".into(),
            optimization_active: false,
            quota_state: QuotaState::ActiveFree,
            refreshed_at: Utc::now(),
            optimized_runs_used: None,
            optimized_runs_limit: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostBreakdownLine {
    pub component_key: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub subtotal: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostBreakdown {
    pub provider: String,
    pub model_id: String,
    pub pricing_entry_id: Option<String>,
    pub source: String,
    pub currency: String,
    pub lines: Vec<CostBreakdownLine>,
    pub total: f64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavingsCalculation {
    pub baseline: CostBreakdown,
    pub optimized: CostBreakdown,
    pub savings_amount: f64,
    pub savings_percent: f64,
}
