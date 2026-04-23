use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthBody {
    pub ok: bool,
    pub version: &'static str,
}

pub async fn health() -> Json<HealthBody> {
    Json(HealthBody {
        ok: true,
        version: crate::constants::runtime_version(),
    })
}
