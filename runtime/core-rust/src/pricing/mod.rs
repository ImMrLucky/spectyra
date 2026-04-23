//! Token cost estimation from pricing snapshots.

pub mod cost_calculator;
pub mod model_resolver;
pub mod types;

pub use cost_calculator::*;
pub use model_resolver::*;
pub use types::*;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum PricingError {
    #[error("missing pricing component for {0}")]
    MissingComponent(String),
    #[error("unknown pricing unit")]
    UnknownUnit,
    #[error("division by zero in pricing")]
    DivisionByZero,
}
