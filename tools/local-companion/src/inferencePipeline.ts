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
import { optimize, type ChatMessage, type OptimizeResult } from "./optimizer.js";

export interface LocalOptimizationStageResult {
  resolved: ReturnType<typeof resolveSpectyraModel>;
  optResult: OptimizeResult;
}

/**
 * Resolve `spectyra/*` aliases and run the Spectyra optimization pipeline for the current run mode
 * (off / observe / on). Does not call the upstream LLM.
 */
export function resolveAndOptimizeLocally(
  cfg: CompanionConfig,
  messages: ChatMessage[],
  rawModel: string,
): LocalOptimizationStageResult {
  const resolved = resolveSpectyraModel(rawModel, {
    provider: cfg.provider,
    aliasSmartModel: cfg.aliasSmartModel,
    aliasFastModel: cfg.aliasFastModel,
    aliasQualityModel: cfg.aliasQualityModel,
  });
  const optResult = optimize(messages, cfg.runMode, cfg.licenseKey);
  return { resolved, optResult };
}
