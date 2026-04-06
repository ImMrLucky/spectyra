/**
 * Bridge module: delegates to @spectyra/optimizer-algorithms.
 */

export {
  extractConstraints,
  extractFailingSignals,
  extractConfirmedTouchedFiles,
  extractLatestToolFailure,
  extractFocusFiles,
  countRecentFailingSignals,
  detectRepeatingErrorCodes,
} from "@spectyra/optimizer-algorithms";
export type { ExtractedConstraints } from "@spectyra/optimizer-algorithms";

export { extractConfirmedTouchedFiles as extractTouchedFiles } from "@spectyra/optimizer-algorithms";
