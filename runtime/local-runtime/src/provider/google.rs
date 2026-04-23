use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use spectyra_core::models::{EndpointClass, NormalizedUsage, ProviderName};

use super::types::{
    ProviderAdapter, ProviderChatRequest, ProviderChatResponse, ProviderEmbeddingsRequest,
    ProviderEmbeddingsResponse, ProviderError,
};

pub struct GoogleGeminiAdapter {
    client: Client,
    api_key: String,
}

impl GoogleGeminiAdapter {
    pub fn new(client: Client, api_key: String) -> Self {
        Self { client, api_key }
    }

    fn contents_from_messages(req: &ProviderChatRequest) -> Vec<Value> {
        let mut out = Vec::new();
        for m in &req.messages {
            let role = if m.role == "assistant" {
                "model"
            } else {
                "user"
            };
            out.push(json!({
                "role": role,
                "parts": [{"text": m.content}],
            }));
        }
        out
    }
}

#[async_trait]
impl ProviderAdapter for GoogleGeminiAdapter {
    async fn run_chat(&self, req: ProviderChatRequest) -> Result<ProviderChatResponse, ProviderError> {
        let model = req.model.trim_start_matches("models/");
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        );
        let body = json!({
            "contents": Self::contents_from_messages(&req),
        });

        let res = self
            .client
            .post(&url)
            .query(&[("key", self.api_key.as_str())])
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Http(e.to_string()))?;

        let status = res.status();
        let text = res.text().await.map_err(|e| ProviderError::Http(e.to_string()))?;
        if !status.is_success() {
            return Err(ProviderError::Api(format!(
                "gemini generateContent HTTP {status}: {text}"
            )));
        }
        let v: Value = serde_json::from_str(&text).map_err(|e| ProviderError::Api(e.to_string()))?;

        let um = v
            .pointer("/usageMetadata")
            .cloned()
            .unwrap_or(json!({}));
        let prompt = um.get("promptTokenCount").and_then(|x| x.as_u64());
        let candidates = um.get("candidatesTokenCount").and_then(|x| x.as_u64());
        let total = um.get("totalTokenCount").and_then(|x| x.as_u64());
        let output_tokens = candidates.or_else(|| match (total, prompt) {
            (Some(t), Some(p)) => Some(t.saturating_sub(p)),
            _ => None,
        });

        let nu = NormalizedUsage {
            provider: ProviderName::Google,
            model_id: req.model.clone(),
            endpoint_class: Some(EndpointClass::Global),
            region: None,
            input_tokens: prompt,
            output_tokens,
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
            raw_provider_usage: Some(um),
        };

        Ok(ProviderChatResponse {
            output: v,
            usage: nu,
        })
    }

    async fn run_embeddings(
        &self,
        req: ProviderEmbeddingsRequest,
    ) -> Result<ProviderEmbeddingsResponse, ProviderError> {
        let model = req.model.trim_start_matches("models/");
        let mut embeddings: Vec<Vec<f64>> = Vec::with_capacity(req.input.len());
        let mut token_total: u64 = 0;

        for text in &req.input {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"
            );
            let body = json!({"content": {"parts":[{"text": text}]}});
            let res = self
                .client
                .post(&url)
                .query(&[("key", self.api_key.as_str())])
                .json(&body)
                .send()
                .await
                .map_err(|e| ProviderError::Http(e.to_string()))?;
            let status = res.status();
            let resp_text = res.text().await.map_err(|e| ProviderError::Http(e.to_string()))?;
            if !status.is_success() {
                return Err(ProviderError::Api(format!(
                    "gemini embedContent HTTP {status}: {resp_text}"
                )));
            }
            let v: Value =
                serde_json::from_str(&resp_text).map_err(|e| ProviderError::Api(e.to_string()))?;
            token_total = token_total.saturating_add(
                v.pointer("/usageMetadata/totalTokenCount")
                    .and_then(|x| x.as_u64())
                    .unwrap_or_else(|| ((text.len() as u64).saturating_add(3)) / 4),
            );
            let vals = v
                .pointer("/embedding/values")
                .and_then(|x| x.as_array())
                .ok_or_else(|| {
                    ProviderError::Api("gemini embedContent: missing embedding.values".into())
                })?;
            embeddings.push(vals.iter().filter_map(|x| x.as_f64()).collect());
        }

        let nu = NormalizedUsage {
            provider: ProviderName::Google,
            model_id: req.model.clone(),
            endpoint_class: Some(EndpointClass::Global),
            region: None,
            input_tokens: Some(token_total),
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

        Ok(ProviderEmbeddingsResponse { embeddings, usage: nu })
    }

    fn provider_name(&self) -> ProviderName {
        ProviderName::Google
    }
}
