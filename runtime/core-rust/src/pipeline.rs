//! Deterministic optimization pipeline (local-only transforms).

use crate::models::{ChatRunRequest, EntitlementStatus, QuotaState};
use crate::transforms::{
    NoOpTransform, PhraseCompressionPlaceholder, RefpackPlaceholder, Transform, TransformError,
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PipelineError {
    #[error("validation: {0}")]
    Validation(String),
    #[error("transform {name}: {source}")]
    Transform {
        name: String,
        #[source]
        source: TransformError,
    },
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PipelineOutput {
    pub request: ChatRunRequest,
    pub transform_names: Vec<String>,
    pub optimization_applied: bool,
    pub passthrough_reason: Option<String>,
    pub warnings: Vec<String>,
}

fn validate(req: &ChatRunRequest) -> Result<(), PipelineError> {
    if req.model.trim().is_empty() {
        return Err(PipelineError::Validation("model required".into()));
    }
    if req.messages.is_empty() {
        return Err(PipelineError::Validation("messages required".into()));
    }
    Ok(())
}

fn normalize(mut req: ChatRunRequest) -> ChatRunRequest {
    for m in &mut req.messages {
        m.role = m.role.trim().to_string();
        m.content = m.content.trim_end().to_string();
    }
    req
}

pub fn optimization_allowed(ent: &EntitlementStatus) -> bool {
    ent.optimization_active && ent.enabled && matches!(ent.quota_state, QuotaState::ActiveFree | QuotaState::ApproachingLimit | QuotaState::ActivePaid)
}

/// Apply transforms in fixed order when optimization is allowed.
pub fn run_chat_pipeline(
    req: ChatRunRequest,
    entitlement: &EntitlementStatus,
    session_frozen: bool,
) -> Result<PipelineOutput, PipelineError> {
    validate(&req)?;
    let req = normalize(req);

    if session_frozen {
        return Ok(PipelineOutput {
            request: req,
            transform_names: vec![],
            optimization_applied: false,
            passthrough_reason: Some("session_metrics_frozen".into()),
            warnings: vec![],
        });
    }

    if !optimization_allowed(entitlement) {
        return Ok(PipelineOutput {
            request: req,
            transform_names: vec![],
            optimization_applied: false,
            passthrough_reason: Some("entitlement_or_quota".into()),
            warnings: vec![],
        });
    }

    let chain: Vec<Box<dyn Transform>> = vec![
        Box::new(NoOpTransform),
        Box::new(RefpackPlaceholder::default()),
        Box::new(PhraseCompressionPlaceholder),
    ];

    let mut current = req;
    let mut names = Vec::new();

    for t in chain {
        if t.applies(&current) {
            current = t.transform(&current).map_err(|e| PipelineError::Transform {
                name: t.name().to_string(),
                source: e,
            })?;
            names.push(t.name().to_string());
        }
    }

    Ok(PipelineOutput {
        request: current,
        transform_names: names,
        optimization_applied: true,
        passthrough_reason: None,
        warnings: vec![],
    })
}
