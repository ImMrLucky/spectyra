//! Pricing snapshot types — JSON aligned with `GET /v1/pricing/snapshot` (camelCase, `price` on components).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PricingComponent {
    pub key: String,
    #[serde(default)]
    pub label: Option<String>,
    /// USD per pricing `unit` (e.g. dollars per 1M tokens when unit is `per_1m_tokens`).
    #[serde(alias = "price")]
    pub unit_price_usd: f64,
    /// API unit string, e.g. `per_1m_tokens` (see `pricingTypes.ts`).
    pub unit: String,
    #[serde(default)]
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingOverride {
    pub multiplier: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDiscount {
    #[serde(default)]
    pub supported: bool,
    pub input_multiplier: Option<f64>,
    pub output_multiplier: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelPricingEntry {
    pub id: String,
    pub provider: String,
    pub model_id: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    pub components: Vec<PricingComponent>,
    #[serde(default)]
    pub batch_discount: Option<BatchDiscount>,
    #[serde(default)]
    pub fallback_from_model_id: Option<String>,
    #[serde(default)]
    pub stale: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderPricingSnapshot {
    pub version: String,
    pub created_at: DateTime<Utc>,
    pub ttl_seconds: u64,
    #[serde(default)]
    pub currency: Option<String>,
    /// Wall time when this snapshot was last fetched (set by runtime; optional in stored JSON).
    #[serde(default)]
    pub fetched_at: Option<DateTime<Utc>>,
    pub entries: Vec<ModelPricingEntry>,
}

impl ProviderPricingSnapshot {
    pub fn resolved_fetched_at(&self) -> DateTime<Utc> {
        self.fetched_at.unwrap_or(self.created_at)
    }

    pub fn is_stale(&self, now: DateTime<Utc>) -> bool {
        let age = now.signed_duration_since(self.resolved_fetched_at());
        age.num_seconds() > self.ttl_seconds as i64
    }
}
