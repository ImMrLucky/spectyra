use async_trait::async_trait;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use serde_json::{json, Value};
use spectyra_core::models::{EndpointClass, Message, NormalizedUsage, ProviderName};

use super::types::{
    ProviderAdapter, ProviderChatRequest, ProviderChatResponse, ProviderEmbeddingsRequest,
    ProviderEmbeddingsResponse, ProviderError,
};

pub struct OpenAiAdapter {
    client: Client,
    api_key: String,
}

impl OpenAiAdapter {
    pub fn new(client: Client, api_key: String) -> Self {
        Self { client, api_key }
    }
}

pub fn map_openai_usage(model: &str, u: &Value) -> NormalizedUsage {
    let prompt = u.get("prompt_tokens").and_then(|x| x.as_u64());
    let completion = u.get("completion_tokens").and_then(|x| x.as_u64());
    NormalizedUsage {
        provider: ProviderName::OpenAI,
        model_id: model.to_string(),
        endpoint_class: Some(EndpointClass::Global),
        region: None,
        input_tokens: prompt,
        output_tokens: completion,
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
        raw_provider_usage: Some(u.clone()),
    }
}

#[async_trait]
impl ProviderAdapter for OpenAiAdapter {
    async fn run_chat(&self, req: ProviderChatRequest) -> Result<ProviderChatResponse, ProviderError> {
        let url = "https://api.openai.com/v1/chat/completions";
        let body_messages: Vec<Value> = req
            .messages
            .iter()
            .map(|m| json!({"role": m.role, "content": m.content}))
            .collect();
        let body = json!({
            "model": req.model,
            "messages": body_messages,
        });

        let res = self
            .client
            .post(url)
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Http(e.to_string()))?;

        let status = res.status();
        let text = res.text().await.map_err(|e| ProviderError::Http(e.to_string()))?;
        if !status.is_success() {
            return Err(ProviderError::Api(format!("openai chat HTTP {status}: {text}")));
        }
        let v: Value = serde_json::from_str(&text).map_err(|e| ProviderError::Api(e.to_string()))?;

        let usage_v = v
            .get("usage")
            .cloned()
            .unwrap_or(json!({}));
        let usage = map_openai_usage(&req.model, &usage_v);
        Ok(ProviderChatResponse {
            output: v,
            usage,
        })
    }

    async fn run_embeddings(
        &self,
        req: ProviderEmbeddingsRequest,
    ) -> Result<ProviderEmbeddingsResponse, ProviderError> {
        let url = "https://api.openai.com/v1/embeddings";
        let body = json!({
            "model": req.model,
            "input": req.input,
        });
        let res = self
            .client
            .post(url)
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Http(e.to_string()))?;
        let status = res.status();
        let text = res.text().await.map_err(|e| ProviderError::Http(e.to_string()))?;
        if !status.is_success() {
            return Err(ProviderError::Api(format!("openai embeddings HTTP {status}: {text}")));
        }
        let v: Value = serde_json::from_str(&text).map_err(|e| ProviderError::Api(e.to_string()))?;
        let usage_v = v.get("usage").cloned().unwrap_or(json!({}));
        let total = usage_v.get("total_tokens").and_then(|x| x.as_u64()).unwrap_or(0);
        let nu = NormalizedUsage {
            provider: ProviderName::OpenAI,
            model_id: req.model.clone(),
            endpoint_class: Some(EndpointClass::Global),
            region: None,
            input_tokens: Some(total),
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
            raw_provider_usage: Some(usage_v),
        };

        let mut embeddings: Vec<Vec<f64>> = Vec::new();
        if let Some(arr) = v.get("data").and_then(|d| d.as_array()) {
            for item in arr {
                if let Some(emb) = item.get("embedding").and_then(|e| e.as_array()) {
                    let vf: Vec<f64> = emb.iter().filter_map(|x| x.as_f64()).collect();
                    embeddings.push(vf);
                }
            }
        }

        Ok(ProviderEmbeddingsResponse {
            embeddings,
            usage: nu,
        })
    }

    fn provider_name(&self) -> ProviderName {
        ProviderName::OpenAI
    }
}

/// OpenAI Responses API (`/v1/responses`). Separate from chat completions.
pub async fn openai_run_responses(
    client: &Client,
    api_key: &str,
    model: &str,
    messages: &[Message],
) -> Result<(Value, NormalizedUsage), ProviderError> {
    let url = "https://api.openai.com/v1/responses";
    let mut combined = String::new();
    for m in messages {
        combined.push_str(&format!("{}: {}\n", m.role, m.content));
    }
    let body = json!({
        "model": model,
        "input": combined.trim(),
    });
    let res = client
        .post(url)
        .header(AUTHORIZATION, format!("Bearer {}", api_key))
        .header(CONTENT_TYPE, "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| ProviderError::Http(e.to_string()))?;
    let status = res.status();
    let text = res.text().await.map_err(|e| ProviderError::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(ProviderError::Api(format!(
            "openai responses HTTP {status}: {text}"
        )));
    }
    let v: Value = serde_json::from_str(&text).map_err(|e| ProviderError::Api(e.to_string()))?;
    let usage_v = v.get("usage").cloned().unwrap_or(json!({}));
    let nu = map_openai_usage(model, &usage_v);
    Ok((v, nu))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_openai_usage_tokens() {
        let u = serde_json::json!({"prompt_tokens": 10u64, "completion_tokens": 20u64});
        let nu = map_openai_usage("gpt-4o-mini", &u);
        assert_eq!(nu.input_tokens, Some(10));
        assert_eq!(nu.output_tokens, Some(20));
    }
}
