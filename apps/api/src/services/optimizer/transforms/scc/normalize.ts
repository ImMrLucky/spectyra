/**
 * Bridge module: delegates to @spectyra/optimizer-algorithms.
 */

export {
  normalizeBullet,
  dedupeOrdered,
  dedupeUserSentencesKeepLast,
  normalizePath,
  dedupeFailingSignals,
} from "@spectyra/optimizer-algorithms";
export type { FailingSignal } from "@spectyra/optimizer-algorithms";
