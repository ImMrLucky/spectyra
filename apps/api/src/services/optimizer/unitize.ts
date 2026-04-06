/**
 * Bridge module: delegates to @spectyra/optimizer-algorithms.
 * Preserves the original API surface so optimizer.ts imports are unchanged.
 */

import type { ChatMsg } from "@spectyra/optimizer-algorithms";
export type ChatMessage = ChatMsg;

export { unitizeMessages } from "@spectyra/optimizer-algorithms";
export type { UnitizeOptions, UnitizeInput } from "@spectyra/optimizer-algorithms";
