//! Local runtime configuration (env + optional TOML).

use serde::{Deserialize, Serialize};
use spectyra_core::models::ProviderName;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderKeysConfig {
    pub openai_api_key_env: String,
    pub anthropic_api_key_env: String,
    pub google_api_key_env: String,
    pub spectyra_account_key_env: String,
}

impl Default for ProviderKeysConfig {
    fn default() -> Self {
        Self {
            openai_api_key_env: "OPENAI_API_KEY".into(),
            anthropic_api_key_env: "ANTHROPIC_API_KEY".into(),
            google_api_key_env: "GEMINI_API_KEY".into(),
            spectyra_account_key_env: "SPECTYRA_ACCOUNT_KEY".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    pub bind: String,
    pub analytics_enabled: bool,
    /// Base URL including `/v1`, e.g. `https://api.spectyra.com/v1`
    pub account_api_base: String,
    pub entitlement_refresh_seconds: u64,
    pub pricing_refresh_seconds: u64,
    pub local_only_enforced: bool,
    /// When entitlement pauses optimization, still call provider with original body.
    pub pass_through_when_paused: bool,
    pub providers: ProviderKeysConfig,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            bind: crate::constants::DEFAULT_BIND.into(),
            analytics_enabled: false,
            account_api_base: std::env::var("SPECTYRA_ACCOUNT_API_BASE")
                .unwrap_or_else(|_| "https://api.spectyra.com/v1".into()),
            entitlement_refresh_seconds: 120,
            pricing_refresh_seconds: 600,
            local_only_enforced: true,
            pass_through_when_paused: true,
            providers: ProviderKeysConfig::default(),
        }
    }
}

impl RuntimeConfig {
    /// Merge TOML file over defaults, then env overrides.
    pub fn load(path: Option<&Path>) -> anyhow::Result<Self> {
        let mut cfg = RuntimeConfig::default();
        if let Some(p) = path {
            if p.exists() {
                let raw = std::fs::read_to_string(p)?;
                let file_cfg: RuntimeConfig = toml::from_str(&raw)?;
                cfg = file_cfg;
            }
        }
        if let Ok(v) = std::env::var("SPECTYRA_RUNTIME_BIND") {
            cfg.bind = v;
        }
        if let Ok(v) = std::env::var("SPECTYRA_ANALYTICS_ENABLED") {
            cfg.analytics_enabled = v == "1" || v.eq_ignore_ascii_case("true");
        }
        if let Ok(v) = std::env::var("SPECTYRA_ACCOUNT_API_BASE") {
            cfg.account_api_base = v;
        }
        if let Ok(v) = std::env::var("SPECTYRA_ENTITLEMENT_REFRESH_SECONDS") {
            cfg.entitlement_refresh_seconds = v.parse().unwrap_or(cfg.entitlement_refresh_seconds);
        }
        if let Ok(v) = std::env::var("SPECTYRA_PRICING_REFRESH_SECONDS") {
            cfg.pricing_refresh_seconds = v.parse().unwrap_or(cfg.pricing_refresh_seconds);
        }
        if let Ok(v) = std::env::var("SPECTYRA_PASS_THROUGH_WHEN_PAUSED") {
            cfg.pass_through_when_paused = v == "1" || v.eq_ignore_ascii_case("true");
        }
        Ok(cfg)
    }

    pub fn resolve_account_api_key(&self) -> Option<String> {
        std::env::var(&self.providers.spectyra_account_key_env).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_loads() {
        let c = RuntimeConfig::load(None).expect("default");
        assert!(c.local_only_enforced);
        assert!(c.bind.contains("4269"));
    }
}

pub fn resolve_provider_api_key(cfg: &RuntimeConfig, provider: &ProviderName) -> Result<String, String> {
    let env_name = match provider {
        ProviderName::OpenAI => &cfg.providers.openai_api_key_env,
        ProviderName::Anthropic => &cfg.providers.anthropic_api_key_env,
        ProviderName::Google => &cfg.providers.google_api_key_env,
        _ => return Err(format!("unsupported provider {:?}", provider)),
    };
    std::env::var(env_name).map_err(|_| format!("missing env {}", env_name))
}

#[derive(Debug, Clone)]
pub struct PricingMeta {
    pub snapshot_version: Option<String>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub ttl_seconds: Option<u64>,
    pub stale: bool,
}

impl Default for PricingMeta {
    fn default() -> Self {
        Self {
            snapshot_version: None,
            created_at: None,
            ttl_seconds: None,
            stale: true,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct StatusExtras {
    pub pricing_meta: PricingMeta,
    pub entitlement_last_refresh: Option<chrono::DateTime<chrono::Utc>>,
    pub entitlement_last_error: Option<String>,
    pub providers_available: HashMap<String, bool>,
    pub upgrade_url: Option<String>,
}
