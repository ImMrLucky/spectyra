//! Conservative repeated-prefix trimming between adjacent user messages (placeholder).

use crate::models::{ChatRunRequest, Message};
use crate::transforms::{Transform, TransformError};

pub struct RefpackPlaceholder {
    pub min_trim_chars: usize,
}

impl Default for RefpackPlaceholder {
    fn default() -> Self {
        Self {
            min_trim_chars: 64,
        }
    }
}

impl Transform for RefpackPlaceholder {
    fn name(&self) -> &'static str {
        "refpack_placeholder"
    }

    fn applies(&self, req: &ChatRunRequest) -> bool {
        req.messages.len() >= 2
    }

    fn transform(&self, req: &ChatRunRequest) -> Result<ChatRunRequest, TransformError> {
        let mut out: Vec<Message> = Vec::new();
        for (i, m) in req.messages.iter().enumerate() {
            if i > 0
                && m.role == "user"
                && req.messages[i - 1].role == "user"
                && !m.content.is_empty()
                && !req.messages[i - 1].content.is_empty()
            {
                let prev = &req.messages[i - 1].content;
                let common = longest_common_prefix(prev.as_str(), m.content.as_str());
                if common >= self.min_trim_chars {
                    let trimmed = m.content.chars().skip(common).collect::<String>();
                    out.push(Message {
                        role: m.role.clone(),
                        content: trimmed,
                    });
                    continue;
                }
            }
            out.push(m.clone());
        }
        let mut next = req.clone();
        next.messages = out;
        Ok(next)
    }
}

fn longest_common_prefix(a: &str, b: &str) -> usize {
    a.chars()
        .zip(b.chars())
        .take_while(|(x, y)| x == y)
        .count()
}
