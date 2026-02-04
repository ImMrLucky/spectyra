import type { ChatMessage } from "@spectyra/shared";
import { getEmbedder } from "../embeddings/embedderRegistry.js";
import { runOptimizedOrBaseline } from "./optimizer.js";
import { makeOptimizerConfig } from "./config.js";
import { mapOptimizationLevelToConfig } from "./optimizationLevel.js";
import { estimateBaselineTokens, estimateOptimizedTokens, getPricingConfig } from "../proof/tokenEstimator.js";
import type { StudioRunRequest, StudioRunResult, StudioScenarioId } from "../../types/studio.js";
import { optimizationLevelToNumber } from "../../types/optimizerLab.js";
import type { OptimizationLevel as NumericOptLevel } from "./optimizationLevel.js";
import crypto from "node:crypto";
import { resolveProvider } from "../llm/providerResolver.js";
import { createOptimizerProvider } from "./providerAdapter.js";
import { estimateCost } from "../../utils/costEstimator.js";

type GovernanceViolation = { code: string; message: string };

function createDryRunProvider() {
  return {
    chat: async () => ({
      text: "DRY_RUN: No provider call made",
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated: true },
    }),
  };
}

function renderMessages(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      const rolePrefix = m.role.toUpperCase();
      return `[${rolePrefix}]\n${m.content ?? ""}`.trim();
    })
    .join("\n\n");
}

function hasAnyTestRequest(messages: ChatMessage[]): boolean {
  const combined = messages
    .filter((m) => m.role === "user")
    .map((m) => String(m.content ?? ""))
    .join("\n");
  return (
    /\brun the full test suite\b/i.test(combined) ||
    /\brun tests?\b/i.test(combined) ||
    /\brun lint\b/i.test(combined) ||
    /\bpnpm\s+test\b/i.test(combined) ||
    /\bpnpm\s+lint\b/i.test(combined) ||
    /\bpaste (?:the )?output\b/i.test(combined)
  );
}

function evaluateAgentBehaviorPrompt(messages: ChatMessage[], rendered: string): GovernanceViolation[] {
  const violations: GovernanceViolation[] = [];
  const isTestRequest = hasAnyTestRequest(messages);

  if (isTestRequest) {
    if (rendered.indexOf("run_terminal_cmd") === -1) {
      violations.push({
        code: "TEST_REQUEST_NOT_MAPPED",
        message: "User asked to run tests/lint but prompt does not explicitly require run_terminal_cmd.",
      });
    }
    if (!/do NOT read_file first/i.test(rendered)) {
      violations.push({
        code: "TEST_REQUEST_ORDERING",
        message: "Prompt must say do NOT read_file first when user asks to run tests/lint.",
      });
    }
    if (!/Do not add narration\./i.test(rendered)) {
      violations.push({
        code: "NARRATION_GUARDRAIL_MISSING",
        message: "Prompt should include a hard stop: Do not add narration.",
      });
    }
  }

  if (!/Only propose code patches AFTER you read_file/i.test(rendered)) {
    violations.push({
      code: "PATCH_BEFORE_READ_FILE",
      message: "Prompt must require read_file of failing file+line before proposing patches.",
    });
  }

  if (!/Treat\s+\.json\s+as\s+JSON/i.test(rendered)) {
    violations.push({
      code: "JSON_ASSUMPTION_RISK",
      message: "Prompt must constrain: Treat .json as JSON (never assume TS/JS).",
    });
  }

  return violations;
}

function computeViolationsPrevented(rawV: GovernanceViolation[] | undefined, spectyraV: GovernanceViolation[] | undefined): number {
  const raw = rawV ?? [];
  const spec = spectyraV ?? [];
  const specCodes = new Set(spec.map((v) => v.code));
  let prevented = 0;
  for (const v of raw) {
    if (!specCodes.has(v.code)) prevented++;
  }
  return prevented;
}

function buildMessagesForScenario(scenarioId: StudioScenarioId, req: StudioRunRequest): { path: "talk" | "code"; messages: ChatMessage[] } {
  const primary = req.inputs?.primary ?? "";
  const secondary = req.inputs?.secondary ?? "";
  const adv = req.inputs?.advanced ?? {};

  if (scenarioId === "token_chat") {
    return { path: "talk", messages: [{ role: "user", content: primary }] };
  }

  if (scenarioId === "token_code") {
    const messages: ChatMessage[] = [{ role: "user", content: primary }];
    if (secondary && secondary.trim()) {
      messages.push({ role: "user", content: secondary });
    }
    return { path: "code", messages };
  }

  // agent_claude and others: use code path; inject rules if provided.
  const messages: ChatMessage[] = [{ role: "user", content: primary }];
  if (adv && typeof adv.rules === "string" && adv.rules.trim()) {
    messages.push({ role: "user", content: String(adv.rules) });
  }
  if (secondary && secondary.trim()) {
    messages.push({ role: "user", content: secondary });
  }
  return { path: "code", messages };
}

function readAdvancedFlag(advanced: any, key: string): boolean {
  return !!advanced && advanced[key] === true;
}

function readAdvancedString(advanced: any, key: string): string | undefined {
  if (!advanced) return undefined;
  const v = advanced[key];
  return typeof v === "string" ? v : undefined;
}

function readAdvancedNumber(advanced: any, key: string): number | undefined {
  if (!advanced) return undefined;
  const v = advanced[key];
  return typeof v === "number" ? v : undefined;
}

function defaultModelForProvider(provider: string): string {
  const p = (provider || "").toLowerCase();
  if (p === "anthropic" || p === "claude") return "claude-3-5-sonnet-latest";
  return "gpt-4o-mini";
}

export async function runStudioScenario(
  req: StudioRunRequest,
  ctx?: { orgId?: string; projectId?: string | null; byokKey?: string }
): Promise<StudioRunResult> {
  const scenarioId = req.scenarioId;
  const embedder = getEmbedder("openai");

  // Use the same config mapping as Optimizer Lab, defaulting to balanced.
  const optimizationLevel = "balanced";
  const numericLevel = optimizationLevelToNumber(optimizationLevel) as NumericOptLevel;

  const { path, messages } = buildMessagesForScenario(scenarioId, req);
  const adv: any = req.inputs?.advanced ?? {};
  const liveProviderRun = readAdvancedFlag(adv, "liveProviderRun");
  const providerName =
    readAdvancedString(adv, "provider") || (scenarioId === "agent_claude" ? "anthropic" : "anthropic");
  const model = readAdvancedString(adv, "model") || defaultModelForProvider(providerName);
  const optLevelNum = readAdvancedNumber(adv, "optimizationLevel");
  const optLevel = Math.max(0, Math.min(4, Math.floor(optLevelNum ?? 2))) as NumericOptLevel;

  // === LIVE provider calls (real tokens/cost) ===
  if (liveProviderRun) {
    const orgId = ctx?.orgId;
    const projectId = ctx?.projectId ?? null;
    const byokKey = ctx?.byokKey;

    const providerResolution = await resolveProvider({
      orgId,
      projectId,
      byokKey,
      providerName,
    });

    if (!providerResolution.provider) {
      const err: any = new Error(providerResolution.error || "Provider key required");
      err.statusCode = providerResolution.statusCode || 401;
      throw err;
    }

    const optimizerProvider = createOptimizerProvider(providerResolution.provider);
    const baseCfgLive = makeOptimizerConfig();
    const cfgLive = mapOptimizationLevelToConfig(path, optLevel, baseCfgLive);

    const t0 = Date.now();
    const baseline = await runOptimizedOrBaseline(
      {
        mode: "baseline",
        path,
        model,
        provider: optimizerProvider as any,
        embedder,
        messages,
        turnIndex: Date.now(),
      },
      cfgLive
    );
    const t1 = Date.now();

    const t2 = Date.now();
    const optimized = await runOptimizedOrBaseline(
      {
        mode: "optimized",
        path,
        model,
        provider: optimizerProvider as any,
        embedder,
        messages,
        turnIndex: Date.now(),
      },
      cfgLive
    );
    const t3 = Date.now();

    const rawUsage =
      baseline.usage || ({ input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated: true } as any);
    const optUsage =
      optimized.usage || ({ input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated: true } as any);

    const rawCost = estimateCost(rawUsage, providerName);
    const optCost = estimateCost(optUsage, providerName);

    const tokenSavingsPct =
      rawUsage.input_tokens > 0 ? ((rawUsage.input_tokens - optUsage.input_tokens) / rawUsage.input_tokens) * 100 : 0;
    const costSavingsPct = rawCost > 0 ? ((rawCost - optCost) / rawCost) * 100 : 0;

    return {
      runId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      raw: {
        outputText: baseline.responseText,
        tokens: { input: rawUsage.input_tokens, output: rawUsage.output_tokens, total: rawUsage.total_tokens },
        latencyMs: t1 - t0,
        costUsd: rawCost,
      },
      spectyra: {
        outputText: optimized.responseText,
        tokens: { input: optUsage.input_tokens, output: optUsage.output_tokens, total: optUsage.total_tokens },
        latencyMs: t3 - t2,
        costUsd: optCost,
      },
      metrics: {
        tokenSavingsPct: Math.round(tokenSavingsPct * 100) / 100,
        costSavingsPct: Math.round(costSavingsPct * 100) / 100,
      },
    };
  }

  const pricing = getPricingConfig("openai");
  const baselineEstimate = estimateBaselineTokens(messages, "openai", pricing);

  const baseCfg = makeOptimizerConfig();
  const cfg = mapOptimizationLevelToConfig(path, numericLevel, baseCfg);

  const t0 = Date.now();
  const optimized = await runOptimizedOrBaseline(
    {
      mode: "optimized",
      path,
      model: "gpt-4",
      provider: createDryRunProvider() as any,
      embedder,
      messages,
      turnIndex: Date.now(),
      dryRun: true,
    },
    cfg
  );
  const t1 = Date.now();

  const optimizedEstimate = estimateOptimizedTokens(optimized.promptFinal.messages, path, numericLevel, "openai", pricing);

  const rawInput = baselineEstimate.input_tokens;
  const rawOutput = baselineEstimate.output_tokens;
  const rawTotal = baselineEstimate.total_tokens;

  const optInput = optimizedEstimate.input_tokens;
  const optOutput = optimizedEstimate.output_tokens;
  const optTotal = optimizedEstimate.total_tokens;

  const tokenSavingsPct = rawInput > 0 ? ((rawInput - optInput) / rawInput) * 100 : 0;
  const costSavingsPct = baselineEstimate.cost_usd > 0 ? ((baselineEstimate.cost_usd - optimizedEstimate.cost_usd) / baselineEstimate.cost_usd) * 100 : 0;

  const rawRendered = renderMessages(messages);
  const spectyraRendered = renderMessages(optimized.promptFinal.messages as any);

  const rawViolations =
    scenarioId === "agent_claude" ? evaluateAgentBehaviorPrompt(messages, rawRendered) : undefined;
  const spectyraViolations =
    scenarioId === "agent_claude" ? evaluateAgentBehaviorPrompt(messages, spectyraRendered) : undefined;

  const violationsPrevented =
    scenarioId === "agent_claude"
      ? computeViolationsPrevented(rawViolations, spectyraViolations)
      : undefined;

  return {
    runId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    raw: {
      outputText: rawRendered,
      tokens: { input: rawInput, output: rawOutput, total: rawTotal },
      latencyMs: 0,
      costUsd: baselineEstimate.cost_usd,
      violations: rawViolations,
    },
    spectyra: {
      outputText: spectyraRendered,
      tokens: { input: optInput, output: optOutput, total: optTotal },
      latencyMs: t1 - t0,
      costUsd: optimizedEstimate.cost_usd,
      violations: spectyraViolations,
    },
    metrics: {
      tokenSavingsPct: Math.round(tokenSavingsPct * 100) / 100,
      costSavingsPct: Math.round(costSavingsPct * 100) / 100,
      violationsPrevented,
    },
  };
}

