pub mod types;

pub use types::*;

use crate::metrics::RunMetrics;
use crate::telemetry::types::{AccountContext, SdkProductionDiagnostics, SdkTelemetryRunPayload};

/// Stable run id when the HTTP request did not supply `requestId`.
pub fn generate_run_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Builds the JSON body expected by `apps/api` `POST /v1/telemetry/run` (same contract as the TS SDK).
/// Does not derive from prompt-bearing structs — only from [`RunMetrics`] + [`AccountContext`].
pub fn sdk_telemetry_run_payload_from_run(
    account_context: &AccountContext,
    run_metrics: &RunMetrics,
) -> SdkTelemetryRunPayload {
    let environment = account_context
        .environment
        .clone()
        .unwrap_or_else(|| "production".to_string());

    let transforms: Vec<String> = run_metrics.transform_names.clone();
    let sample = if transforms.is_empty() {
        None
    } else {
        Some(transforms.iter().take(40).cloned().collect())
    };

    SdkTelemetryRunPayload {
        environment,
        model: run_metrics.model_id.clone(),
        input_tokens: run_metrics.input_tokens_before.unwrap_or(0),
        output_tokens: run_metrics.output_tokens_after.unwrap_or(0),
        optimized_tokens: run_metrics.input_tokens_after.unwrap_or(0),
        estimated_cost: run_metrics.cost_before,
        optimized_cost: run_metrics.cost_after,
        savings: run_metrics.savings_amount,
        diagnostics: SdkProductionDiagnostics {
            provider: run_metrics.provider.clone(),
            run_id: run_metrics.run_id.clone(),
            estimated_savings_pct: run_metrics.savings_percent,
            transform_count: transforms.len() as u32,
            transforms_applied_sample: sample,
        },
        project: account_context.project_id.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::QuotaState;

    #[test]
    fn sdk_payload_matches_post_run_shape() {
        let ac = AccountContext {
            account_id: None,
            org_id: None,
            app_id: None,
            project_id: Some("my-project".into()),
            environment: Some("dev".into()),
        };
        let run = RunMetrics {
            provider: "openai".into(),
            model_id: "gpt-4o".into(),
            run_id: "run-abc".into(),
            input_tokens_before: Some(10),
            output_tokens_before: Some(5),
            input_tokens_after: Some(8),
            output_tokens_after: Some(5),
            cost_before: 1.0,
            cost_after: 0.9,
            savings_amount: 0.1,
            savings_percent: 10.0,
            latency_ms: Some(50),
            transform_names: vec!["noop".into()],
            quota_state_at_run: QuotaState::ActiveFree,
        };
        let p = sdk_telemetry_run_payload_from_run(&ac, &run);
        let v = serde_json::to_value(&p).unwrap();
        assert_eq!(v["environment"], "dev");
        assert_eq!(v["model"], "gpt-4o");
        assert_eq!(v["inputTokens"], 10);
        assert_eq!(v["outputTokens"], 5);
        assert_eq!(v["optimizedTokens"], 8);
        assert_eq!(v["estimatedCost"], 1.0);
        assert_eq!(v["optimizedCost"], 0.9);
        assert_eq!(v["savings"], 0.1);
        assert_eq!(v["project"], "my-project");
        assert_eq!(v["diagnostics"]["runId"], "run-abc");
        assert_eq!(v["diagnostics"]["estimatedSavingsPct"], 10.0);
    }

    #[test]
    fn sdk_payload_json_excludes_forbidden_keys() {
        let ac = AccountContext {
            account_id: Some("acc".into()),
            org_id: Some("org".into()),
            app_id: None,
            project_id: Some("proj".into()),
            environment: Some("dev".into()),
        };
        let run = RunMetrics {
            provider: "openai".into(),
            model_id: "gpt-4o".into(),
            run_id: "r1".into(),
            input_tokens_before: Some(10),
            output_tokens_before: Some(5),
            input_tokens_after: Some(8),
            output_tokens_after: Some(5),
            cost_before: 1.0,
            cost_after: 0.9,
            savings_amount: 0.1,
            savings_percent: 10.0,
            latency_ms: Some(50),
            transform_names: vec!["noop".into()],
            quota_state_at_run: QuotaState::ActiveFree,
        };
        let p = sdk_telemetry_run_payload_from_run(&ac, &run);
        let json = serde_json::to_string(&p).unwrap();
        let lower = json.to_lowercase();
        assert!(!lower.contains("messages"));
        assert!(!lower.contains("completion"));
        assert!(!lower.contains("\"content\""));
        assert!(
            !lower.contains("\"prompt\""),
            "unexpected prompt-like key in telemetry JSON"
        );
        assert!(!lower.contains("api_key"));
        assert!(!lower.contains("authorization"));
        assert!(!lower.contains("x-api-key"));
    }

}
