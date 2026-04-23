pub mod noop;
pub mod phrase_compress;
pub mod refpack_placeholder;

pub use noop::NoOpTransform;
pub use phrase_compress::PhraseCompressionPlaceholder;
pub use refpack_placeholder::RefpackPlaceholder;

use crate::models::ChatRunRequest;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TransformError {
    #[error("{0}")]
    Msg(String),
}

pub trait Transform: Send + Sync {
    fn name(&self) -> &'static str;
    fn applies(&self, req: &ChatRunRequest) -> bool;
    fn transform(&self, req: &ChatRunRequest) -> Result<ChatRunRequest, TransformError>;
}
