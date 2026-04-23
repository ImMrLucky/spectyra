pub mod anthropic;
pub mod google;
pub mod openai;
pub mod types;

pub use anthropic::AnthropicAdapter;
pub use google::GoogleGeminiAdapter;
pub use openai::{openai_run_responses, OpenAiAdapter};
pub use types::*;

use spectyra_core::models::ProviderName;
use std::sync::Arc;

use crate::config::resolve_provider_api_key;
use crate::config::RuntimeConfig;

/// Select a provider implementation (keys from local env via `RuntimeConfig`).
pub fn adapter_for(
    cfg: &RuntimeConfig,
    client: &reqwest::Client,
    provider: &ProviderName,
) -> Result<Arc<dyn ProviderAdapter>, ProviderError> {
    let key = resolve_provider_api_key(cfg, provider).map_err(ProviderError::Config)?;
    let c = client.clone();
    let p: Arc<dyn ProviderAdapter> = match provider {
        ProviderName::OpenAI => Arc::new(OpenAiAdapter::new(c, key)),
        ProviderName::Anthropic => Arc::new(AnthropicAdapter::new(c, key)),
        ProviderName::Google => Arc::new(GoogleGeminiAdapter::new(c, key)),
        _ => {
            return Err(ProviderError::Config(format!(
                "provider {:?} is not implemented in local runtime yet",
                provider
            )))
        }
    };
    Ok(p)
}
