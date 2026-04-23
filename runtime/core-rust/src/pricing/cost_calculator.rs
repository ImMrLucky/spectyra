//! Cost and savings from usage + pricing entry.

use crate::models::{CostBreakdown, CostBreakdownLine, NormalizedUsage, SavingsCalculation};

use super::types::{ModelPricingEntry, PricingComponent};
use super::PricingError;

fn round_money(x: f64) -> f64 {
    (x * 1_000_000.0).round() / 1_000_000.0
}

fn component_scale(unit: crate::pricing::types::PricingUnit) -> Result<f64, PricingError> {
    use crate::pricing::types::PricingUnit;
    match unit {
        PricingUnit::Per1MTokens => Ok(1.0 / 1_000_000.0),
        PricingUnit::Per1KTokens => Ok(1.0 / 1_000.0),
        PricingUnit::PerRequest => Ok(1.0),
        PricingUnit::PerHour => Ok(1.0),
    }
}

fn classify_key(key: &str) -> &'static str {
    let k = key.to_lowercase();
    match k.as_str() {
        k if k.contains("input") || k == "prompt" => "input",
        k if k.contains("output") || k == "completion" => "output",
        k if k.contains("cache_read") || k == "cached" || k.contains("cached_input") => {
            "cache_read"
        }
        k if k.contains("cache_write") => "cache_write",
        k if k.contains("reason") || k.contains("think") => "reasoning",
        _ => "other",
    }
}

fn pick_component<'a>(
    components: &'a [PricingComponent],
    class: &'static str,
) -> Option<&'a PricingComponent> {
    components.iter().find(|c| classify_key(&c.key) == class)
}

pub fn calculate_cost(
    usage: &NormalizedUsage,
    entry: &ModelPricingEntry,
) -> Result<CostBreakdown, PricingError> {
    let mut warnings = Vec::new();
    if entry.stale == Some(true) {
        warnings.push("pricing entry marked stale".to_string());
    }

    let batch_mult = if usage.batch == Some(true) {
        entry.batch_discount.unwrap_or(1.0)
    } else {
        1.0
    };

    let input_tokens = usage.input_tokens.unwrap_or(0) as f64;
    let output_tokens = usage.output_tokens.unwrap_or(0) as f64;
    let cache_read = usage
        .cache_read_tokens
        .or(usage.cached_input_tokens)
        .unwrap_or(0) as f64;
    let cache_write = usage.cache_write_tokens.unwrap_or(0) as f64;
    let reasoning = usage
        .reasoning_tokens
        .or(usage.thinking_tokens)
        .unwrap_or(0) as f64;

    let input_comp = pick_component(&entry.components, "input");
    let output_comp = pick_component(&entry.components, "output");
    let cache_read_comp = pick_component(&entry.components, "cache_read");
    let cache_write_comp = pick_component(&entry.components, "cache_write");
    let reasoning_comp = pick_component(&entry.components, "reasoning");

    let mut billable_output = output_tokens;
    if reasoning_comp.is_some() && reasoning > 0.0 {
        billable_output = (output_tokens - reasoning).max(0.0);
    }

    let mut lines: Vec<CostBreakdownLine> = Vec::new();

    fn add_line(
        lines: &mut Vec<CostBreakdownLine>,
        key: &str,
        comp: &PricingComponent,
        qty: f64,
        batch_mult: f64,
        notes: Option<String>,
    ) -> Result<(), PricingError> {
        if qty <= 0.0 {
            return Ok(());
        }
        let scale = component_scale(comp.unit)?;
        let unit_price = comp.unit_price_usd * scale;
        let subtotal = round_money(qty * unit_price * batch_mult);
        lines.push(CostBreakdownLine {
            component_key: key.to_string(),
            quantity: qty,
            unit_price: round_money(unit_price),
            subtotal,
            notes,
        });
        Ok(())
    }

    if let Some(c) = input_comp {
        add_line(
            &mut lines,
            &c.key,
            c,
            input_tokens,
            batch_mult,
            Some("input tokens".into()),
        )?;
    } else if input_tokens > 0.0 {
        return Err(PricingError::MissingComponent("input".into()));
    }

    if let Some(c) = output_comp {
        add_line(
            &mut lines,
            &c.key,
            c,
            billable_output,
            batch_mult,
            Some("output tokens (reasoning-adjusted when applicable)".into()),
        )?;
    } else if billable_output > 0.0 {
        return Err(PricingError::MissingComponent("output".into()));
    }

    if let Some(c) = cache_read_comp {
        add_line(
            &mut lines,
            &c.key,
            c,
            cache_read,
            batch_mult,
            Some("cache read".into()),
        )?;
    }

    if let Some(c) = cache_write_comp {
        add_line(
            &mut lines,
            &c.key,
            c,
            cache_write,
            batch_mult,
            Some("cache write".into()),
        )?;
    }

    if let Some(c) = reasoning_comp {
        if reasoning > 0.0 {
            add_line(
                &mut lines,
                &c.key,
                c,
                reasoning,
                batch_mult,
                Some("reasoning/thinking tokens".into()),
            )?;
        }
    }

    let total = round_money(lines.iter().map(|l| l.subtotal).sum());

    Ok(CostBreakdown {
        provider: entry.provider.clone(),
        model_id: entry.model_id.clone(),
        pricing_entry_id: Some(entry.id.clone()),
        source: "spectyra_estimate".into(),
        currency: entry.currency.clone(),
        lines,
        total,
        warnings,
    })
}

pub fn calculate_savings(
    baseline_usage: &NormalizedUsage,
    optimized_usage: &NormalizedUsage,
    baseline_entry: &ModelPricingEntry,
    optimized_entry: &ModelPricingEntry,
) -> Result<SavingsCalculation, PricingError> {
    let baseline = calculate_cost(baseline_usage, baseline_entry)?;
    let optimized = calculate_cost(optimized_usage, optimized_entry)?;
    let savings_amount = round_money((baseline.total - optimized.total).max(0.0));
    let savings_percent = if baseline.total > 0.0 {
        round_money((savings_amount / baseline.total) * 100.0)
    } else {
        0.0
    };

    Ok(SavingsCalculation {
        baseline,
        optimized,
        savings_amount,
        savings_percent,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ProviderName;
    use crate::pricing::types::PricingUnit;

    fn sample_entry() -> ModelPricingEntry {
        ModelPricingEntry {
            id: "e1".into(),
            provider: "openai".into(),
            model_id: "gpt-4o".into(),
            currency: "USD".into(),
            components: vec![
                PricingComponent {
                    key: "input_tokens".into(),
                    unit_price_usd: 2.50,
                    unit: PricingUnit::Per1MTokens,
                },
                PricingComponent {
                    key: "output_tokens".into(),
                    unit_price_usd: 10.0,
                    unit: PricingUnit::Per1MTokens,
                },
                PricingComponent {
                    key: "reasoning_tokens".into(),
                    unit_price_usd: 5.0,
                    unit: PricingUnit::Per1MTokens,
                },
            ],
            batch_discount: Some(0.5),
            fallback_from_model_id: None,
            stale: None,
        }
    }

    fn usage(input: u64, output: u64, reasoning: u64) -> NormalizedUsage {
        NormalizedUsage {
            provider: ProviderName::OpenAI,
            model_id: "gpt-4o".into(),
            endpoint_class: None,
            region: None,
            input_tokens: Some(input),
            output_tokens: Some(output),
            cached_input_tokens: None,
            cache_write_tokens: None,
            cache_read_tokens: None,
            thinking_tokens: None,
            reasoning_tokens: Some(reasoning),
            tool_calls: None,
            web_search_calls: None,
            grounded_prompts: None,
            image_inputs: None,
            image_outputs: None,
            audio_input_tokens: None,
            audio_output_tokens: None,
            storage_hours: None,
            batch: None,
            raw_provider_usage: None,
        }
    }

    #[test]
    fn avoids_double_reasoning_charge() {
        let entry = sample_entry();
        let u = usage(1_000_000, 500_000, 100_000);
        let c = calculate_cost(&u, &entry).unwrap();
        let out_line = c.lines.iter().find(|l| l.component_key == "output_tokens").unwrap();
        assert!((out_line.quantity - 400_000.0).abs() < 1.0);
    }

    #[test]
    fn batch_discount_applies() {
        let entry = sample_entry();
        let mut u_batch = usage(1_000_000, 0, 0);
        u_batch.batch = Some(true);
        let c_batch = calculate_cost(&u_batch, &entry).unwrap();
        let u_full = usage(1_000_000, 0, 0);
        let c_full = calculate_cost(&u_full, &entry).unwrap();
        assert!(c_batch.total < c_full.total);
    }
}
