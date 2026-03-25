import type { ProfitGateOptions, ProfitGateResult, ChatMsg } from "./types.js";
import { estimateInputTokens } from "./math.js";

export function profitGate(
  beforeMsgs: ChatMsg[],
  afterMsgs: ChatMsg[],
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
  return { useAfter, before, after, pct, absChange, label };
}

export const TALK_PROFIT_GATE: ProfitGateOptions = { minPctGain: 3, minAbsGain: 40 };
export const CODE_PROFIT_GATE: ProfitGateOptions = { minPctGain: 2, minAbsGain: 60 };
