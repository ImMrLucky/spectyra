use serde::Serialize;

/// What may leave the local runtime toward Spectyra **control plane** (aggregated only).
#[derive(Debug, Clone, Serialize)]
pub struct AggregatedRunTelemetry {
    pub org_id: Option<String>,
    pub project_id: Option<String>,
    pub run_id: String,
    pub provider: String,
    pub model: String,
    pub input_tokens_before: u64,
    pub input_tokens_after: u64,
    pub output_tokens: u64,
    pub estimated_cost_before: f64,
    pub estimated_cost_after: f64,
    pub estimated_savings: f64,
    pub savings_pct: f64,
    pub sdk_version: String,
    pub quota_state: Option<String>,
}

impl AggregatedRunTelemetry {
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_has_no_message_keys() {
        let t = AggregatedRunTelemetry {
            org_id: None,
            project_id: None,
            run_id: "r1".to_string(),
            provider: "openai".to_string(),
            model: "gpt-4o-mini".to_string(),
            input_tokens_before: 10,
            input_tokens_after: 4,
            output_tokens: 2,
            estimated_cost_before: 0.01,
            estimated_cost_after: 0.005,
            estimated_savings: 0.005,
            savings_pct: 50.0,
            sdk_version: "0.0.1".to_string(),
            quota_state: Some("active_free".to_string()),
        };
        let s = t.to_json().unwrap();
        assert!(!s.to_lowercase().contains("prompt"));
        assert!(!s.to_lowercase().contains("message"));
    }
}
