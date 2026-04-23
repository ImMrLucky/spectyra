use crate::app::create_router;
use crate::state::AppState;

pub async fn serve(state: AppState, bind: &str) -> anyhow::Result<()> {
    let app = create_router(state);
    let listener = tokio::net::TcpListener::bind(bind).await?;
    tracing::info!(%bind, "spectyra local runtime listening");
    axum::serve(listener, app).await?;
    Ok(())
}
