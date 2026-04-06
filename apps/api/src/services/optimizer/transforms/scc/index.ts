/**
 * Bridge barrel: delegates to @spectyra/optimizer-algorithms.
 */
export {
  normalizeBullet,
  dedupeOrdered,
  normalizePath,
  dedupeFailingSignals,
} from "@spectyra/optimizer-algorithms";
export type { FailingSignal } from "@spectyra/optimizer-algorithms";
export {
  extractConstraints,
  extractFailingSignals,
  extractConfirmedTouchedFiles as extractTouchedFiles,
} from "@spectyra/optimizer-algorithms";
export type { ExtractedConstraints } from "@spectyra/optimizer-algorithms";
