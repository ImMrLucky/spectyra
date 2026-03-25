import type { SpectralResult, Budgets, ChatMsg } from "./types.js";
import { countRecentFailingSignals, detectRepeatingErrorCodes } from "./scc/extract.js";

export interface BudgetsFromSpectralInput {
  spectral: SpectralResult;
  baseKeepLastTurns?: number;
  baseMaxRefs?: number;
  messages?: ChatMsg[];
}

export function computeBudgetsFromSpectral(input: BudgetsFromSpectralInput): Budgets {
  const { spectral, baseKeepLastTurns = 3, baseMaxRefs = 6, messages } = input;
  const stability = spectral.stabilityIndex;
  const contradictionEnergy = Math.abs(spectral.contradictionEnergy);
  const novelty = spectral._internal?.noveltyAvg ?? 0.5;
  const normalizedStability = Math.max(0, Math.min(1, stability));
  const normalizedContradiction = Math.max(0, Math.min(1, contradictionEnergy / 2));
  const normalizedNovelty = Math.max(0, Math.min(1, novelty));

  const compressionAggressiveness = Math.max(0.3, Math.min(1.0,
    normalizedStability * 0.7 + (1 - normalizedNovelty) * 0.3
  ));
  const phrasebookAggressiveness = compressionAggressiveness * 0.9;
  const codemapDetailLevel = Math.max(0.4, Math.min(1.0,
    1.0 - (normalizedStability * 0.4) + (normalizedContradiction * 0.3)
  ));
  const maxRefpackEntries = Math.max(3, Math.min(12,
    Math.round(baseMaxRefs + (normalizedStability * 4) - (normalizedNovelty * 2))
  ));
  let stateCompressionLevel = Math.max(0, Math.min(1, normalizedStability * 0.8 + (1 - normalizedNovelty) * 0.2));
  const lambda2 = spectral.lambda2 ?? 0;
  let keepLastTurns = lambda2 < 0.12 ? 2 : 4;
  let maxStateChars = lambda2 < 0.12 ? 1800 : 3200;
  let retainToolLogs = lambda2 > 0.15;
  const minRefpackSavings = 30;

  if (messages && messages.length > 0) {
    const recentFailures = countRecentFailingSignals(messages, 12);
    const repeatingCodes = detectRepeatingErrorCodes(messages);
    if (recentFailures > 0 || repeatingCodes.length > 0) {
      stateCompressionLevel = Math.min(stateCompressionLevel, 0.35);
      keepLastTurns = Math.max(keepLastTurns, 6);
      retainToolLogs = true;
    }
  }

  return {
    keepLastTurns, maxRefpackEntries, minRefpackSavings,
    compressionAggressiveness, phrasebookAggressiveness,
    codemapDetailLevel, stateCompressionLevel, maxStateChars, retainToolLogs,
  };
}
