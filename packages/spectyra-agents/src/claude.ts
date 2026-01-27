/**
 * Claude SDK / Claude-style Agent Wrapper
 * 
 * Wraps Claude SDK patterns to optimize messages before LLM calls.
 * Supports CodeMap, RefPack, and PhraseBook optimizations.
 */

import type { ClaudeLikeMessage, RepoContext, OptimizationReportPublic } from "./types";
import { optimizeAgentMessages, type ChatMessage } from "./core/optimizeAgentMessages";

/**
 * Configuration for Claude wrapper
 */
export interface ClaudeWrapperConfig {
  apiEndpoint?: string;
  apiKey?: string;
}

/**
 * Input for Claude request optimization
 */
export interface WrapClaudeRequestInput {
  messages: ClaudeLikeMessage[];
  repoContext?: RepoContext;
  mode?: "auto" | "code" | "chat";
  runId?: string;
  config?: ClaudeWrapperConfig;
}

/**
 * Output from Claude request optimization
 */
export interface WrapClaudeRequestOutput {
  messages: ClaudeLikeMessage[];
  optimizationReport: OptimizationReportPublic;
  cacheKey?: string;
  cacheHit?: boolean;
}

/**
 * Convert Claude-like messages to internal format
 */
function toChatMessages(claudeMessages: ClaudeLikeMessage[]): ChatMessage[] {
  return claudeMessages.map(msg => {
    if (msg.role === "tool") {
      return {
        role: "tool",
        content: msg.content,
      };
    }
    return {
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    };
  });
}

/**
 * Convert internal messages back to Claude-like format
 */
function fromChatMessages(chatMessages: ChatMessage[], originalMessages: ClaudeLikeMessage[]): ClaudeLikeMessage[] {
  // Preserve original structure (tool_name, etc.) while updating content
  const result: ClaudeLikeMessage[] = [];
  let chatIdx = 0;
  
  for (const original of originalMessages) {
    if (chatIdx < chatMessages.length) {
      const chatMsg = chatMessages[chatIdx];
      
      if (original.role === "tool") {
        result.push({
          role: "tool",
          tool_name: original.tool_name,
          content: chatMsg.content,
        });
      } else {
        result.push({
          role: original.role,
          content: chatMsg.content,
        });
      }
      
      chatIdx++;
    } else {
      // New messages added (e.g., CodeMap system message)
      result.push(original);
    }
  }
  
  // Add any new messages (like CodeMap) that weren't in original
  while (chatIdx < chatMessages.length) {
    const chatMsg = chatMessages[chatIdx];
    if (chatMsg.role === "system") {
      result.unshift({
        role: "system",
        content: chatMsg.content,
      });
    }
    chatIdx++;
  }
  
  return result;
}

/**
 * Wrap Claude request to optimize messages before LLM call
 * 
 * @example
 * ```ts
 * const { messages, optimizationReport } = await wrapClaudeRequest({
 *   messages: claudeMessages,
 *   repoContext: { files: [...] },
 *   mode: "code",
 *   config: {
 *     apiEndpoint: "https://spectyra.up.railway.app/v1",
 *     apiKey: process.env.SPECTYRA_API_KEY,
 *   },
 * });
 * 
 * // Use optimized messages with Claude SDK
 * const response = await claudeClient.messages.create({
 *   model: "claude-3-5-sonnet",
 *   messages: messages,
 * });
 * ```
 */
export async function wrapClaudeRequest(
  input: WrapClaudeRequestInput
): Promise<WrapClaudeRequestOutput> {
  const { messages, repoContext, mode = "auto", runId, config } = input;
  
  // Convert to internal format
  const chatMessages = toChatMessages(messages);
  
  // Optimize messages
  const optimized = await optimizeAgentMessages({
    messages: chatMessages,
    repoContext,
    mode,
    runId,
    apiEndpoint: config?.apiEndpoint,
    apiKey: config?.apiKey,
  });
  
  // Convert back to Claude format
  const optimizedClaudeMessages = fromChatMessages(optimized.messages, messages);
  
  return {
    messages: optimizedClaudeMessages,
    optimizationReport: optimized.optimizationReport,
    cacheKey: optimized.cacheKey,
    cacheHit: optimized.cacheHit,
  };
}
