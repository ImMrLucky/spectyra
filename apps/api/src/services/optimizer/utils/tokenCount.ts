/**
 * Token counting and profit gates for PG-SCC.
 * Ensures no transform step increases token count unless explicitly allowed.
 */

import type { ChatMessage } from "@spectyra/shared";

const CHARS_PER_TOKEN = 4;

/**
 * Estimate input tokens from message content (same logic as proof/tokenEstimator).
 */
export function estimateInputTokens(messages: ChatMessage[]): number {
  if (!messages?.length) return 0;
  return messages.reduce((sum, msg) => {
    const text = msg.content ?? "";
    return sum + Math.ceil(text.length / CHARS_PER_TOKEN);
  }, 0);
}

export interface ProfitGateOptions {
  /** Minimum percentage gain required to use "after" (e.g. 2 = 2%, 3 = 3%). */
  minPctGain: number;
  /** Minimum absolute token reduction (e.g. 40 for talk, 60 for code). */
  minAbsGain: number;
}

export interface ProfitGateResult {
  /** True if we should use afterMsgs (step is net-positive). */
  useAfter: boolean;
  before: number;
  after: number;
  pct: number;
  /** Absolute token change (positive = saved). */
  absChange: number;
  label: string;
}

/**
 * Profit gate: only allow a transform if it saves at least minPctGain and minAbsGain.
 * Returns useAfter: false if the step would increase tokens or save too little.
 */
export function profitGate(
  beforeMsgs: ChatMessage[],
  afterMsgs: ChatMessage[],
  options: ProfitGateOptions,
  label: string
): ProfitGateResult {
  const before = estimateInputTokens(beforeMsgs);
  const after = estimateInputTokens(afterMsgs);
  const absChange = before - after;
  const pct = before > 0 ? (absChange / before) * 100 : 0;

  const meetsPct = pct >= options.minPctGain;
  const meetsAbs = absChange >= options.minAbsGain;
  const useAfter = meetsPct && meetsAbs && after <= before;

  return {
    useAfter,
    before,
    after,
    pct,
    absChange,
    label,
  };
}

/** Talk path: min 3% gain, min 40 tokens saved. */
export const TALK_PROFIT_GATE: ProfitGateOptions = {
  minPctGain: 3,
  minAbsGain: 40,
};

/** Code path: min 2% gain, min 60 tokens saved (code logs are bigger). */
export const CODE_PROFIT_GATE: ProfitGateOptions = {
  minPctGain: 2,
  minAbsGain: 60,
};
