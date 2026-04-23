use crate::models::ChatRunRequest;
use crate::transforms::{Transform, TransformError};

pub struct NoOpTransform;

impl Transform for NoOpTransform {
    fn name(&self) -> &'static str {
        "noop"
    }

    fn applies(&self, _req: &ChatRunRequest) -> bool {
        true
    }

    fn transform(&self, req: &ChatRunRequest) -> Result<ChatRunRequest, TransformError> {
        Ok(req.clone())
    }
}
