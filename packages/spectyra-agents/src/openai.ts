/**
 * OpenAI / Codex / OpenAI Agents Wrapper
 * 
 * Wraps OpenAI-style agent patterns to optimize messages before LLM calls.
 * Supports both chat.completions and newer Agents API patterns.
 */

import type { OpenAILikeMessage, RepoContext, OptimizationReportPublic, SpectyraRunMode, SavingsReport, PromptComparison } from "./types";
import { optimizeAgentMessages, type ChatMessage } from "./core/optimizeAgentMessages";

/**
 * Configuration for OpenAI wrapper
 */
export interface OpenAIWrapperConfig {
  apiEndpoint?: string;
  apiKey?: string;
}

/**
 * Input for OpenAI request optimization
 */
export interface WrapOpenAIInputInput {
  messages: OpenAILikeMessage[];
  repoContext?: RepoContext;
  mode?: "auto" | "code" | "chat";
  runMode?: SpectyraRunMode;
  runId?: string;
  config?: OpenAIWrapperConfig;
}

/**
 * Output from OpenAI request optimization
 */
export interface WrapOpenAIInputOutput {
  messages: OpenAILikeMessage[];
  optimizationReport: OptimizationReportPublic;
  savingsReport?: SavingsReport;
  promptComparison?: PromptComparison;
  cacheKey?: string;
  cacheHit?: boolean;
}

/**
 * Convert OpenAI-like messages to internal format
 */
function toChatMessages(openaiMessages: OpenAILikeMessage[]): ChatMessage[] {
  return openaiMessages.map(msg => {
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
 * Convert internal messages back to OpenAI-like format
 */
function fromChatMessages(chatMessages: ChatMessage[], originalMessages: OpenAILikeMessage[]): OpenAILikeMessage[] {
  // Preserve original structure (name, etc.) while updating content
  const result: OpenAILikeMessage[] = [];
  let chatIdx = 0;
  
  for (const original of originalMessages) {
    if (chatIdx < chatMessages.length) {
      const chatMsg = chatMessages[chatIdx];
      
      if (original.role === "tool") {
        result.push({
          role: "tool",
          name: original.name,
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
 * Wrap OpenAI input to optimize messages before LLM call
 * 
 * @example
 * ```ts
 * const { messages, optimizationReport } = await wrapOpenAIInput({
 *   messages: openaiMessages,
 *   repoContext: { files: [...] },
 *   mode: "code",
 *   config: {
 *     apiEndpoint: "https://spectyra.up.railway.app/v1",
 *     apiKey: process.env.SPECTYRA_API_KEY,
 *   },
 * });
 * 
 * // Use optimized messages with OpenAI SDK
 * const response = await openai.chat.completions.create({
 *   model: "gpt-4o",
 *   messages: messages,
 * });
 * ```
 */
export async function wrapOpenAIInput(
  input: WrapOpenAIInputInput
): Promise<WrapOpenAIInputOutput> {
  const { messages, repoContext, mode = "auto", runMode, runId, config } = input;

  const chatMessages = toChatMessages(messages);

  const optimized = await optimizeAgentMessages({
    messages: chatMessages,
    repoContext,
    mode,
    runMode,
    runId,
    apiEndpoint: config?.apiEndpoint,
    apiKey: config?.apiKey,
  });

  const optimizedOpenAIMessages = fromChatMessages(optimized.messages, messages);

  return {
    messages: optimizedOpenAIMessages,
    optimizationReport: optimized.optimizationReport,
    savingsReport: optimized.savingsReport,
    promptComparison: optimized.promptComparison,
    cacheKey: optimized.cacheKey,
    cacheHit: optimized.cacheHit,
  };
}
