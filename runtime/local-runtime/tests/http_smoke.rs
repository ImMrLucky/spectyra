use axum::{body::Body, http::Request};
use spectyra_local_runtime::app::create_router;
use spectyra_local_runtime::config::RuntimeConfig;
use spectyra_local_runtime::state::AppState;
use tower::ServiceExt;

#[tokio::test]
async fn health_returns_version() {
    let cfg = RuntimeConfig::default();
    let http = reqwest::Client::new();
    let state = AppState::new(cfg, http);
    let app = create_router(state);

    let res = app
        .oneshot(
            Request::builder()
                .uri("/v1/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), 200);
}
