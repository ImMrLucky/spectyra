use axum::routing::{get, post};
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::routes::{
    analytics, embeddings, health, metrics, pricing, quota, reload, responses, run_chat, status,
};
use crate::state::AppState;

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/v1/health", get(health::health))
        .route("/v1/status", get(status::status))
        .route("/v1/quota", get(quota::quota))
        .route("/v1/metrics/session", get(metrics::session_metrics))
        .route("/v1/pricing/meta", get(pricing::pricing_meta))
        .route("/v1/chat/run", post(run_chat::post_run_chat))
        .route("/v1/responses/run", post(responses::post_responses_run))
        .route("/v1/embeddings/run", post(embeddings::post_embeddings_run))
        .route("/v1/analytics/flush", post(analytics::flush_analytics))
        .route("/v1/runtime/reload-config", post(reload::reload_config))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
