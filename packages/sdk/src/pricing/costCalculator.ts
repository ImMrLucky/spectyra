import type {
  CostBreakdown,
  CostBreakdownLine,
  ModelPricingEntry,
  NormalizedUsage,
  PricingUnit,
  SavingsCalculation,
} from "./types.js";

function roundMoney(x: number): number {
  return Math.round(x * 1_000_000) / 1_000_000;
}

function scaleForUnit(unit: PricingUnit): number {
  switch (unit) {
    case "per_1m_tokens":
      return 1 / 1_000_000;
    case "per_1k_calls":
      return 1 / 1000;
    default:
      return 1;
  }
}

function classifyKey(key: string): "input" | "output" | "cache_read" | "cache_write" | "reasoning" | "other" {
  const k = key.toLowerCase();
  if (k.includes("input") || k === "prompt") return "input";
  if (k.includes("output") || k === "completion") return "output";
  if (k.includes("cache_read") || k.includes("cached")) return "cache_read";
  if (k.includes("cache_write")) return "cache_write";
  if (k.includes("reason") || k.includes("think")) return "reasoning";
  return "other";
}

function pickComponent(entry: ModelPricingEntry, cls: ReturnType<typeof classifyKey>) {
  return entry.components.find(c => classifyKey(c.key) === cls);
}

function resolveCostSource(usage: NormalizedUsage, linesEmpty: boolean, billableTokens: number): CostBreakdown["source"] {
  const o = usage.costSourceOverride;
  if (o === "manual_override") return "manual_override";
  if (o === "fallback_estimate" || (linesEmpty && billableTokens > 0)) {
    return "fallback_estimate";
  }
  if (usage.rawProviderUsage != null && typeof usage.rawProviderUsage === "object") {
    return "provider_usage_plus_registry";
  }
  return "registry_only";
}

/**
 * Estimate cost from normalized usage + registry entry.
 */
export function calculateCostFromEntry(
  usage: NormalizedUsage,
  entry: ModelPricingEntry,
  warnings: string[],
): CostBreakdown {
  const lines: CostBreakdownLine[] = [];
  const batchOn = Boolean(usage.batch && entry.batchDiscount?.supported);
  const inputBatchMult = batchOn ? (entry.batchDiscount?.inputMultiplier ?? 1) : 1;
  const outputBatchMult = batchOn ? (entry.batchDiscount?.outputMultiplier ?? 1) : 1;

  const inputTok = usage.inputTokens ?? 0;
  const outputTok = usage.outputTokens ?? 0;
  const reasoningTok = usage.reasoningTokens ?? usage.thinkingTokens ?? 0;

  const inputC = pickComponent(entry, "input");
  const outputC = pickComponent(entry, "output");
  const reasoningC = pickComponent(entry, "reasoning");

  let billableOutput = outputTok;
  if (reasoningC && reasoningTok > 0 && !entry.metadata?.includesThinkingInOutput) {
    billableOutput = Math.max(0, outputTok - reasoningTok);
  }

  const add = (
    key: string,
    qty: number,
    comp: (typeof entry.components)[0] | undefined,
    batchMult: number,
    note?: string,
  ) => {
    if (qty <= 0 || !comp) return;
    const scale = scaleForUnit(comp.unit);
    const unitPrice = comp.price * scale;
    const subtotal = roundMoney(qty * unitPrice * batchMult);
    lines.push({
      componentKey: key,
      quantity: qty,
      unitPrice: roundMoney(unitPrice),
      subtotal,
      notes: note,
    });
  };

  if (inputC) add(inputC.key, inputTok, inputC, inputBatchMult, "input tokens");
  if (outputC) add(outputC.key, billableOutput, outputC, outputBatchMult, "output tokens");
  if (reasoningC && reasoningTok > 0) add(reasoningC.key, reasoningTok, reasoningC, outputBatchMult, "reasoning tokens");

  const total = roundMoney(lines.reduce((s, l) => s + l.subtotal, 0));
  const billableTok = inputTok + outputTok + reasoningTok;
  if (lines.length === 0 && billableTok > 0 && !usage.costSourceOverride) {
    warnings.push(
      "Registry entry has no matching priced components for this usage — totals are not reliable (fallback_estimate).",
    );
  }

  return {
    provider: entry.provider,
    modelId: entry.modelId,
    pricingEntryId: entry.id,
    source: resolveCostSource(usage, lines.length === 0, billableTok),
    currency: entry.components[0]?.currency ?? "USD",
    lines,
    total,
    warnings: [...warnings],
  };
}

export function calculateSavingsFromUsages(
  baseline: NormalizedUsage,
  optimized: NormalizedUsage,
  baselineEntry: ModelPricingEntry,
  optimizedEntry: ModelPricingEntry,
): SavingsCalculation {
  const w1: string[] = [];
  const w2: string[] = [];
  const b = calculateCostFromEntry(baseline, baselineEntry, w1);
  const o = calculateCostFromEntry(optimized, optimizedEntry, w2);
  const savingsAmount = roundMoney(Math.max(0, b.total - o.total));
  const savingsPercent = b.total > 0 ? roundMoney((savingsAmount / b.total) * 100) : 0;
  return {
    baseline: { ...b, warnings: [...b.warnings, ...w1] },
    optimized: { ...o, warnings: [...o.warnings, ...w2] },
    savingsAmount,
    savingsPercent,
  };
}
