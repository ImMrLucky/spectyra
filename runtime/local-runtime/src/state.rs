use spectyra_core::metrics::SessionMetrics;
use spectyra_core::models::EntitlementStatus;
use spectyra_core::pricing::ProviderPricingSnapshot;
use spectyra_core::telemetry::SdkTelemetryRunPayload;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::config::{RuntimeConfig, StatusExtras};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<RwLock<RuntimeConfig>>,
    pub entitlement: Arc<RwLock<EntitlementStatus>>,
    pub pricing_snapshot: Arc<RwLock<Option<ProviderPricingSnapshot>>>,
    pub session_metrics: Arc<RwLock<SessionMetrics>>,
    pub analytics_queue: Arc<RwLock<Vec<SdkTelemetryRunPayload>>>,
    pub http: reqwest::Client,
    pub status: Arc<RwLock<StatusExtras>>,
}

impl AppState {
    pub fn new(config: RuntimeConfig, http: reqwest::Client) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            entitlement: Arc::new(RwLock::new(EntitlementStatus::offline_default())),
            pricing_snapshot: Arc::new(RwLock::new(None)),
            session_metrics: Arc::new(RwLock::new(SessionMetrics::default())),
            analytics_queue: Arc::new(RwLock::new(Vec::new())),
            http,
            status: Arc::new(RwLock::new(StatusExtras::default())),
        }
    }
}
