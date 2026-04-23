//! Thin glue from `spectyra_core` pipeline — extra logic lives in route handlers.

pub use spectyra_core::{
    optimization_allowed, run_chat_pipeline, PipelineError, PipelineOutput,
};
