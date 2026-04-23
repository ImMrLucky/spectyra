//! Pricing snapshot types (Spectyra estimate path).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingComponent {
    pub key: String,
    /// USD per unit (e.g. per 1M tokens).
    pub unit_price_usd: f64,
    pub unit: PricingUnit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PricingUnit {
    Per1MTokens,
    Per1KTokens,
    PerRequest,
    PerHour,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingOverride {
    pub multiplier: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricingEntry {
    pub id: String,
    pub provider: String,
    #[serde(alias = "modelId")]
    pub model_id: String,
    pub currency: String,
    pub components: Vec<PricingComponent>,
    pub batch_discount: Option<f64>,
    pub fallback_from_model_id: Option<String>,
    pub stale: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPricingSnapshot {
    pub version: String,
    #[serde(alias = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(alias = "ttlSeconds")]
    pub ttl_seconds: u64,
    pub fetched_at: DateTime<Utc>,
    pub entries: Vec<ModelPricingEntry>,
}

impl ProviderPricingSnapshot {
    pub fn is_stale(&self, now: DateTime<Utc>) -> bool {
        let age = now.signed_duration_since(self.fetched_at);
        age.num_seconds() > self.ttl_seconds as i64
    }
}
