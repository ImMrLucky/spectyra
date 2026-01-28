import type { PathKind, OptimizerConfig } from "./optimizer";
import type { OptimizationLevel } from "@spectyra/shared";

// Re-export canonical type
export type { OptimizationLevel };

export interface OptimizationLevelConfig {
  // Talk policy
  compactionAggressive: boolean;
  trimAggressive: boolean;
  maxRefs: number;
  keepLastTurns: number;
  
  // Code policy
  codeSlicerAggressive: boolean;
  patchModeDefault: boolean;
  patchModeAggressiveOnReuse: boolean;
}

const TALK_LEVELS: Record<OptimizationLevel, OptimizationLevelConfig> = {
  0: {
    compactionAggressive: false,
    trimAggressive: false,
    maxRefs: 12,
    keepLastTurns: 4,
    codeSlicerAggressive: false, // not used for talk
    patchModeDefault: false,
    patchModeAggressiveOnReuse: false,
  },
  1: {
    compactionAggressive: false,
    trimAggressive: true,
    maxRefs: 10,
    keepLastTurns: 3,
    codeSlicerAggressive: false,
    patchModeDefault: false,
    patchModeAggressiveOnReuse: false,
  },
  2: {
    compactionAggressive: true,
    trimAggressive: true,
    maxRefs: 10,
    keepLastTurns: 2,
    codeSlicerAggressive: false,
    patchModeDefault: false,
    patchModeAggressiveOnReuse: false,
  },
  3: {
    compactionAggressive: true,
    trimAggressive: true,
    maxRefs: 8,
    keepLastTurns: 2,
    codeSlicerAggressive: false,
    patchModeDefault: false,
    patchModeAggressiveOnReuse: false,
  },
  4: {
    compactionAggressive: true,
    trimAggressive: true,
    maxRefs: 6,
    keepLastTurns: 2,
    codeSlicerAggressive: false,
    patchModeDefault: false,
    patchModeAggressiveOnReuse: false,
  },
};

const CODE_LEVELS: Record<OptimizationLevel, OptimizationLevelConfig> = {
  0: {
    compactionAggressive: false,
    trimAggressive: false,
    maxRefs: 10,
    keepLastTurns: 4,
    codeSlicerAggressive: false,
    patchModeDefault: false,
    patchModeAggressiveOnReuse: false,
  },
  1: {
    compactionAggressive: true,
    trimAggressive: true,
    maxRefs: 8,
    keepLastTurns: 3,
    codeSlicerAggressive: true,
    patchModeDefault: false,
    patchModeAggressiveOnReuse: false,
  },
  2: {
    compactionAggressive: true,
    trimAggressive: true,
    maxRefs: 6,
    keepLastTurns: 2,
    codeSlicerAggressive: true,
    patchModeDefault: true,
    patchModeAggressiveOnReuse: true,
  },
  3: {
    compactionAggressive: true,
    trimAggressive: true,
    maxRefs: 5,
    keepLastTurns: 2,
    codeSlicerAggressive: true,
    patchModeDefault: true,
    patchModeAggressiveOnReuse: true,
  },
  4: {
    compactionAggressive: true,
    trimAggressive: true,
    maxRefs: 4,
    keepLastTurns: 2,
    codeSlicerAggressive: true,
    patchModeDefault: true,
    patchModeAggressiveOnReuse: true,
  },
};

/**
 * Maps (path, optimization_level) to OptimizerConfig overrides
 */
export function mapOptimizationLevelToConfig(
  path: PathKind,
  level: OptimizationLevel,
  baseConfig: OptimizerConfig
): OptimizerConfig {
  const levelConfig = path === "talk" ? TALK_LEVELS[level] : CODE_LEVELS[level];
  
  const keepLastTurns = levelConfig.keepLastTurns;
  
  return {
    ...baseConfig,
    talkPolicy: {
      maxRefs: levelConfig.maxRefs,
      compactionAggressive: levelConfig.compactionAggressive,
      trimAggressive: levelConfig.trimAggressive,
      keepLastTurns,
    },
    codePolicy: {
      maxRefs: levelConfig.maxRefs,
      patchModeDefault: levelConfig.patchModeDefault,
      patchModeAggressiveOnReuse: levelConfig.patchModeAggressiveOnReuse,
      trimAggressive: levelConfig.trimAggressive,
      keepLastTurns,
      codeSlicerAggressive: levelConfig.codeSlicerAggressive,
    },
  };
}

/**
 * Get keepLastTurns value for a given path and level
 */
export function getKeepLastTurns(path: PathKind, level: OptimizationLevel): number {
  const levelConfig = path === "talk" ? TALK_LEVELS[level] : CODE_LEVELS[level];
  return levelConfig.keepLastTurns;
}

/**
 * Get codeSlicerAggressive value for a given level (code path only)
 */
export function getCodeSlicerAggressive(level: OptimizationLevel): boolean {
  return CODE_LEVELS[level].codeSlicerAggressive;
}
