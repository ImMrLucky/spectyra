/**
 * Local inference pipeline — shared path for OpenAI- and Anthropic-compatible endpoints.
 *
 * Flow (all local; no Spectyra cloud relay):
 *   request intake → normalize messages → resolve model alias → optimization pipeline →
 *   workflow policy gate → upstream provider call → response shaping (in companion route)
 *
 * OpenClaw and other agents only differ at the HTTP/schema edge; stages below are integration-agnostic.
 */

import { resolveSpectyraModel } from "@spectyra/shared";
import type { CompanionConfig } from "./config.js";
import { resolveLicenseKeyForOptimize } from "./billingEntitlement.js";
import { optimize, type ChatMessage, type OptimizeResult } from "./optimizer.js";

export interface LocalOptimizationStageResult {
  resolved: ReturnType<typeof resolveSpectyraModel>;
  optResult: OptimizeResult;
}

/**
 * Resolve `spectyra/*` aliases and run the Spectyra optimization pipeline for the current run mode
 * (off / observe / on). Does not call the upstream LLM.
 *
 * Real input trimming requires a linked account with active trial or subscription (see billing status).
 */
export async function resolveAndOptimizeLocally(
  cfg: CompanionConfig,
  messages: ChatMessage[],
  rawModel: string,
): Promise<LocalOptimizationStageResult> {
  const resolved = resolveSpectyraModel(rawModel, {
    provider: cfg.provider,
    aliasSmartModel: cfg.aliasSmartModel,
    aliasFastModel: cfg.aliasFastModel,
    aliasQualityModel: cfg.aliasQualityModel,
    providerTierModels: cfg.providerTierModels,
  });
  const licenseForOptimize = await resolveLicenseKeyForOptimize(cfg);
  const optResult = optimize(messages, cfg.optimizationRunMode, licenseForOptimize);
  return { resolved, optResult };
}
