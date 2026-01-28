import { config } from "../../config.js";
import type { OptimizerConfig } from "./optimizer";

export function makeOptimizerConfig(): OptimizerConfig {
  return {
    spectral: {
      tLow: config.optimizer.stabilityTLow,
      tHigh: config.optimizer.stabilityTHigh,
      maxNodes: 50,
      similarityEdgeMin: config.optimizer.similarityReuseThreshold,
      contradictionEdgeWeight: -0.8,
    },
    unitize: {
      maxUnits: 50,
      minChunkChars: 40,
      maxChunkChars: 900,
      includeSystem: false,
    },
    talkPolicy: {
      maxRefs: 8,
      compactionAggressive: true,
      trimAggressive: true,
    },
    codePolicy: {
      maxRefs: 6,
      patchModeDefault: config.optimizer.codePatchModeDefault,
      patchModeAggressiveOnReuse: true,
      trimAggressive: true,
    },
    maxOutputTokensOptimized: config.optimizer.maxOutputTokensOptimized,
  };
}
