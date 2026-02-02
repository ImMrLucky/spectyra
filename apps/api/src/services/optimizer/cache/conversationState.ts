/**
 * Markov State Carry — PG-SCC
 *
 * Store compiled state per conversation so we don't resend full history.
 * Keyspace: state:{conversationId}
 */

import type { ChatMessage } from "@spectyra/shared";
import { getCacheStore } from "./createCacheStore";

const STATE_KEY_PREFIX = "state:";
const STATE_TTL_SECONDS = 86400; // 24 hours

export interface ConversationState {
  stateMsg: ChatMessage;
  lastTurn: ChatMessage[];
}

export async function getConversationState(
  conversationId: string
): Promise<ConversationState | null> {
  const store = getCacheStore();
  if (!store) return null;
  const key = STATE_KEY_PREFIX + conversationId;
  try {
    const raw = await store.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConversationState;
    if (!parsed.stateMsg?.content || !Array.isArray(parsed.lastTurn)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setConversationState(
  conversationId: string,
  stateMsg: ChatMessage,
  lastTurn: ChatMessage[]
): Promise<void> {
  const store = getCacheStore();
  if (!store) return;
  const key = STATE_KEY_PREFIX + conversationId;
  const value = JSON.stringify({ stateMsg, lastTurn });
  try {
    await store.set(key, value, STATE_TTL_SECONDS);
  } catch (err) {
    console.error("setConversationState failed:", err);
  }
}
