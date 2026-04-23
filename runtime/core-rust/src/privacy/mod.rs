//! Privacy helpers — explicit separation from prompt-bearing types.

/// Marker trait: types implementing this are safe to serialize to Spectyra cloud analytics.
pub trait PrivacySafeAggregate: serde::Serialize {}
