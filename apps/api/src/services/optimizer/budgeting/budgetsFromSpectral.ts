/**
 * Spectral-Driven Budget Control
 * 
 * Core Moat v1: Use spectral outputs to dynamically set:
 * - keep_last_turns
 * - max_refpack_entries
 * - compression_aggressiveness
 * - phrasebook_aggressiveness
 * - codemap_detail_level
 */

import { SpectralResult } from "../spectral/types";

export interface Budgets {
  keepLastTurns: number;
  maxRefpackEntries: number;
  /** Emit RefPack dictionary system message only if net_savings >= this (tokens). Default INLINE_ONLY otherwise. */
  minRefpackSavings: number;
  compressionAggressiveness: number; // 0-1 scale
  phrasebookAggressiveness: number; // 0-1 scale
  codemapDetailLevel: number; // 0-1 scale (1 = full detail, 0 = minimal)
  /** PG-SCC: state compression level 0–1 (0 = off, 1 = aggressive). */
  stateCompressionLevel: number;
  /** Max chars for compiled state message (talk vs code have different defaults). */
  maxStateChars: number;
  /** Code: retain tool logs in state (errors, stack traces). */
  retainToolLogs: boolean;
}

export interface BudgetsFromSpectralInput {
  spectral: SpectralResult;
  baseKeepLastTurns?: number;
  baseMaxRefs?: number;
}

/**
 * Compute budgets from spectral signals
 * 
 * Budgets tighten when:
 * - stability high
 * - novelty low
 * - contradiction energy low
 * 
 * Budgets loosen when:
 * - contradictions high
 * - novelty high
 * - stability is dropping ("acceleration" negative)
 */
export function computeBudgetsFromSpectral(input: BudgetsFromSpectralInput): Budgets {
  const { spectral, baseKeepLastTurns = 3, baseMaxRefs = 6 } = input;

  const stability = spectral.stabilityIndex;
  const contradictionEnergy = Math.abs(spectral.contradictionEnergy);
  const novelty = spectral._internal?.noveltyAvg ?? 0.5; // Default to medium novelty

  // Normalize values to 0-1 range
  const normalizedStability = Math.max(0, Math.min(1, stability));
  const normalizedContradiction = Math.max(0, Math.min(1, contradictionEnergy / 2)); // Scale down
  const normalizedNovelty = Math.max(0, Math.min(1, novelty));

  // High stability + low novelty + low contradiction = tight budgets (aggressive compression)
  // Low stability + high novelty + high contradiction = loose budgets (preserve more)
  
  // Compression aggressiveness: higher when stable, lower when unstable
  const compressionAggressiveness = Math.max(0.3, Math.min(1.0, 
    normalizedStability * 0.7 + (1 - normalizedNovelty) * 0.3
  ));

  // Phrasebook aggressiveness: similar to compression
  const phrasebookAggressiveness = compressionAggressiveness * 0.9; // Slightly less aggressive

  // CodeMap detail level: preserve more detail when unstable
  const codemapDetailLevel = Math.max(0.4, Math.min(1.0,
    1.0 - (normalizedStability * 0.4) + (normalizedContradiction * 0.3)
  ));

  // Keep last turns: spectral-derived fallback; λ₂ overrides for SCC alignment
  const keepLastTurnsBase = Math.max(1, Math.min(5,
    Math.round(baseKeepLastTurns - (normalizedStability * 2) + (normalizedContradiction * 1.5))
  ));

  // Max refpack entries: more when stable (more reusable content), fewer when unstable
  const maxRefpackEntries = Math.max(3, Math.min(12,
    Math.round(baseMaxRefs + (normalizedStability * 4) - (normalizedNovelty * 2))
  ));

  // PG-SCC: state compression (higher when stable)
  const stateCompressionLevel = Math.max(0, Math.min(1, normalizedStability * 0.8 + (1 - normalizedNovelty) * 0.2));

  // Budgets → SCC alignment: λ₂ drives aggressiveness (low λ₂ = tighter, high λ₂ = preserve more)
  const lambda2 = spectral.lambda2 ?? 0;
  const keepLastTurns = lambda2 < 0.12 ? 2 : 4;
  const maxStateChars = lambda2 < 0.12 ? 1800 : 3200;
  const retainToolLogs = lambda2 > 0.15;
  const minRefpackSavings = 30;

  return {
    keepLastTurns,
    maxRefpackEntries,
    minRefpackSavings,
    compressionAggressiveness,
    phrasebookAggressiveness,
    codemapDetailLevel,
    stateCompressionLevel,
    maxStateChars,
    retainToolLogs,
  };
}
