//! Spectyra Rust core — pricing, metrics, quota, privacy-safe telemetry, optimization pipeline.

pub mod aggregated_telemetry;
pub mod config;
pub mod errors;
pub mod metrics;
pub mod models;
pub mod pipeline;
pub mod pricing;
pub mod privacy;
pub mod quota;
pub mod telemetry;
pub mod transforms;
pub mod usage;

pub use aggregated_telemetry::AggregatedRunTelemetry;
pub use metrics::{RunMetrics, SessionMetrics};
pub use models::*;
pub use pipeline::{optimization_allowed, run_chat_pipeline, PipelineError, PipelineOutput};
pub use pricing::{
    calculate_cost, calculate_savings, resolve_entry, ModelPricingEntry, PricingError,
    ProviderPricingSnapshot,
};
pub use quota::{apply_quota_to_session, clear_quota_freeze, quota_should_freeze};
pub use telemetry::{
    generate_run_id, sdk_telemetry_run_payload_from_run, AccountContext, SdkProductionDiagnostics,
    SdkTelemetryRunPayload,
};
