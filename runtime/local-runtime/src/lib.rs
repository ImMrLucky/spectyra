//! Local Axum runtime for non-Node Spectyra integrations.

pub mod app;
pub mod config;
pub mod constants;
pub mod errors;
pub mod provider;
pub mod routes;
pub mod server;
pub mod services;
pub mod state;

use std::path::PathBuf;
use std::time::Duration;

use crate::state::AppState;

pub async fn run() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let args: Vec<String> = std::env::args().collect();
    let config_path = args
        .windows(2)
        .find(|w| w[0] == "--config")
        .map(|w| PathBuf::from(&w[1]))
        .or_else(|| std::env::var("SPECTYRA_RUNTIME_CONFIG").ok().map(PathBuf::from));

    let cfg = config::RuntimeConfig::load(config_path.as_deref())?;
    let bind = cfg.bind.clone();
    let ent_secs = cfg.entitlement_refresh_seconds;
    let price_secs = cfg.pricing_refresh_seconds;

    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()?;

    let state = AppState::new(cfg, http);

    refresh_provider_env_flags(&state).await;

    services::entitlement_refresh::refresh_once(&state).await;
    services::pricing_refresh::refresh_once(&state).await;

    services::entitlement_refresh::spawn_entitlement_loop(state.clone(), ent_secs);
    services::pricing_refresh::spawn_pricing_loop(state.clone(), price_secs);
    services::analytics_emitter::spawn_emitter_loop(state.clone());

    crate::server::serve(state, &bind).await
}

pub async fn refresh_provider_env_flags(state: &AppState) {
    let cfg = state.config.read().await;
    let mut m = std::collections::HashMap::new();
    m.insert(
        "openai".into(),
        std::env::var(&cfg.providers.openai_api_key_env).is_ok(),
    );
    m.insert(
        "anthropic".into(),
        std::env::var(&cfg.providers.anthropic_api_key_env).is_ok(),
    );
    m.insert(
        "google".into(),
        std::env::var(&cfg.providers.google_api_key_env).is_ok(),
    );
    drop(cfg);
    let mut st = state.status.write().await;
    st.providers_available = m;
}
