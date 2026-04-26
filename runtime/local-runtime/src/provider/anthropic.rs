use async_trait::async_trait;
use reqwest::header::{CONTENT_TYPE, HeaderMap, HeaderValue};
use reqwest::Client;
use serde_json::{json, Value};
use spectyra_core::models::{EndpointClass, NormalizedUsage, ProviderName};

use super::types::{
    ProviderAdapter, ProviderChatRequest, ProviderChatResponse, ProviderEmbeddingsRequest,
    ProviderEmbeddingsResponse, ProviderError,
};

pub struct AnthropicAdapter {
    client: Client,
    api_key: String,
}

impl AnthropicAdapter {
    pub fn new(client: Client, api_key: String) -> Self {
        Self { client, api_key }
    }
}

#[async_trait]
impl ProviderAdapter for AnthropicAdapter {
    async fn run_chat(&self, req: ProviderChatRequest) -> Result<ProviderChatResponse, ProviderError> {
        let url = "https://api.anthropic.com/v1/messages";
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(&self.api_key).map_err(|e| ProviderError::Config(e.to_string()))?,
        );
        headers.insert(
            "anthropic-version",
            HeaderValue::from_static("2023-06-01"),
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let mut system_parts: Vec<String> = Vec::new();
        let mut api_messages = Vec::new();
        for m in &req.messages {
            if m.role == "system" {
                system_parts.push(m.content.clone());
                continue;
            }
            api_messages.push(json!({
                "role": m.role,
                "content": [{"type":"text","text": m.content}],
            }));
        }
        let mut body = json!({
            "model": req.model,
            "max_tokens": 4096,
            "messages": api_messages,
        });
        if let Some(obj) = body.as_object_mut() {
            if !system_parts.is_empty() {
                obj.insert("system".into(), json!(system_parts.join("\n")));
            }
        }

        let res = self
            .client
            .post(url)
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Http(e.to_string()))?;

        let status = res.status();
        let text = res.text().await.map_err(|e| ProviderError::Http(e.to_string()))?;
        if !status.is_success() {
            return Err(ProviderError::Api(format!("anthropic messages HTTP {status}: {text}")));
        }
        let v: Value = serde_json::from_str(&text).map_err(|e| ProviderError::Api(e.to_string()))?;

        let usage_v = v.get("usage").cloned().unwrap_or(json!({}));
        let input = usage_v.get("input_tokens").and_then(|x| x.as_u64());
        let output = usage_v.get("output_tokens").and_then(|x| x.as_u64());
        let nu = NormalizedUsage {
            provider: ProviderName::Anthropic,
            model_id: req.model.clone(),
            endpoint_class: Some(EndpointClass::Global),
            region: None,
            input_tokens: input,
            output_tokens: output,
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
            raw_provider_usage: Some(usage_v),
            cost_source_override: None,
        };

        Ok(ProviderChatResponse {
            output: v,
            usage: nu,
        })
    }

    async fn run_embeddings(
        &self,
        _req: ProviderEmbeddingsRequest,
    ) -> Result<ProviderEmbeddingsResponse, ProviderError> {
        Err(ProviderError::Api(
            "Anthropic embeddings are not exposed via this adapter in this runtime version".into(),
        ))
    }

    fn provider_name(&self) -> ProviderName {
        ProviderName::Anthropic
    }
}
