use serde::{Deserialize, Serialize};
use serde_json::Value;
use spectyra_core::models::{Message, NormalizedUsage, ProviderName};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderChatRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderChatResponse {
    pub output: Value,
    pub usage: NormalizedUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderEmbeddingsRequest {
    pub model: String,
    pub input: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderEmbeddingsResponse {
    pub embeddings: Vec<Vec<f64>>,
    pub usage: NormalizedUsage,
}

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("configuration: {0}")]
    Config(String),
    #[error("http: {0}")]
    Http(String),
    #[error("provider api: {0}")]
    Api(String),
}

#[async_trait::async_trait]
pub trait ProviderAdapter: Send + Sync {
    async fn run_chat(&self, req: ProviderChatRequest) -> Result<ProviderChatResponse, ProviderError>;
    async fn run_embeddings(
        &self,
        req: ProviderEmbeddingsRequest,
    ) -> Result<ProviderEmbeddingsResponse, ProviderError>;
    fn provider_name(&self) -> ProviderName;
}
