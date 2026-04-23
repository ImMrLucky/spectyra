//! Resolve `ModelPricingEntry` with exact match and fallbacks.

use super::types::ModelPricingEntry;

pub fn resolve_entry<'a>(
    entries: &'a [ModelPricingEntry],
    provider: &str,
    model_id: &str,
    warnings: &mut Vec<String>,
) -> Option<&'a ModelPricingEntry> {
    let exact = entries.iter().find(|e| {
        e.provider.eq_ignore_ascii_case(provider) && e.model_id.eq_ignore_ascii_case(model_id)
    });
    if let Some(e) = exact {
        return Some(e);
    }

    if let Some(stripped) = strip_version_suffix_owned(model_id) {
        let v = entries.iter().find(|e| {
            e.provider.eq_ignore_ascii_case(provider)
                && e.model_id.eq_ignore_ascii_case(&stripped)
        });
        if let Some(e) = v {
            warnings.push(format!(
                "pricing: using stripped model id fallback '{stripped}' for '{model_id}'"
            ));
            return Some(e);
        }
    }

    let prefix = entries.iter().find(|e| {
        e.provider.eq_ignore_ascii_case(provider)
            && model_id.starts_with(&e.model_id)
            && e.model_id.len() >= 4
    });
    if let Some(e) = prefix {
        warnings.push(format!(
            "pricing: prefix fallback matched entry '{}' for model '{}'",
            e.model_id, model_id
        ));
        return Some(e);
    }

    let provider_default = entries.iter().find(|e| {
        e.provider.eq_ignore_ascii_case(provider)
            && (e.model_id.eq_ignore_ascii_case("*") || e.model_id.eq_ignore_ascii_case("default"))
    });
    if let Some(e) = provider_default {
        warnings.push(format!(
            "pricing: provider default entry used for model '{model_id}'"
        ));
        return Some(e);
    }

    None
}

fn strip_version_suffix_owned(model_id: &str) -> Option<String> {
    let parts: Vec<&str> = model_id.split('-').collect();
    if parts.len() >= 2 {
        let last = parts[parts.len() - 1];
        if last.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '_') && !last.is_empty() {
            return Some(parts[..parts.len() - 1].join("-"));
        }
    }
    None
}
