import type { NormalizedUsage } from "./types.js";

export function normalizedUsageFromTokens(input: {
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  batch?: boolean;
}): NormalizedUsage {
  return {
    provider: input.provider,
    modelId: input.modelId,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    batch: input.batch,
  };
}
