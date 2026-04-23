//! Placeholder phrase compression: collapse excessive blank lines in message bodies.

use crate::models::{ChatRunRequest, Message};
use crate::transforms::{Transform, TransformError};

pub struct PhraseCompressionPlaceholder;

impl Transform for PhraseCompressionPlaceholder {
    fn name(&self) -> &'static str {
        "phrase_compression_placeholder"
    }

    fn applies(&self, req: &ChatRunRequest) -> bool {
        req.messages.iter().any(|m| m.content.contains("\n\n\n"))
    }

    fn transform(&self, req: &ChatRunRequest) -> Result<ChatRunRequest, TransformError> {
        let messages = req
            .messages
            .iter()
            .map(|m| Message {
                role: m.role.clone(),
                content: collapse_blank_runs(&m.content),
            })
            .collect();
        let mut next = req.clone();
        next.messages = messages;
        Ok(next)
    }
}

fn collapse_blank_runs(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut blank_run = 0usize;
    for ch in s.chars() {
        if ch == '\n' {
            blank_run += 1;
            if blank_run <= 2 {
                out.push(ch);
            }
        } else {
            blank_run = 0;
            out.push(ch);
        }
    }
    out
}
