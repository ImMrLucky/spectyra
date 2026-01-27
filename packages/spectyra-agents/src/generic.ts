/**
 * Framework-Agnostic Agent Loop Wrapper
 * 
 * Universal adapter for any agent framework.
 * Provides a generic wrapper that works with any message format.
 */

import type { GenericMessage, RepoContext, OptimizationReportPublic } from "./types";
import { optimizeAgentMessages, type ChatMessage } from "./core/optimizeAgentMessages";

/**
 * Configuration for generic wrapper
 */
export interface GenericWrapperConfig {
  apiEndpoint?: string;
  apiKey?: string;
}

/**
 * Generic agent loop wrapper configuration
 */
export interface WrapGenericAgentLoopConfig<TReq, TRes> {
  /**
   * Convert framework request to messages
   */
  toMessages(req: TReq): GenericMessage[];
  
  /**
   * Convert messages back to framework request
   */
  fromMessages(messages: GenericMessage[], originalReq: TReq): TReq;
  
  /**
   * The actual provider call (Claude/OpenAI/Gemini/etc)
   */
  callProvider(req: TReq): Promise<TRes>;
  
  /**
   * Extract assistant text from provider response
   */
  getAssistantText(res: TRes): string;
  
  /**
   * Extract tool calls from provider response (optional)
   */
  getToolCalls?(res: TRes): any[];
  
  /**
   * Repo context for CodeMap optimization
   */
  repoContext?: RepoContext;
  
  /**
   * Mode: auto (detect from context), code, or chat
   */
  mode?: "auto" | "code" | "chat";
  
  /**
   * Run ID for tracking
   */
  runId?: string;
  
  /**
   * Spectyra API configuration
   */
  spectyraConfig?: GenericWrapperConfig;
}

/**
 * Convert generic messages to internal format
 */
function toChatMessages(genericMessages: GenericMessage[]): ChatMessage[] {
  return genericMessages.map(msg => ({
    role: msg.role as "system" | "user" | "assistant" | "tool",
    content: msg.content,
  }));
}

/**
 * Convert internal messages back to generic format
 */
function fromChatMessages(chatMessages: ChatMessage[], originalMessages: GenericMessage[]): GenericMessage[] {
  const result: GenericMessage[] = [];
  let chatIdx = 0;
  
  for (const original of originalMessages) {
    if (chatIdx < chatMessages.length) {
      const chatMsg = chatMessages[chatIdx];
      result.push({
        role: chatMsg.role,
        content: chatMsg.content,
        meta: original.meta, // Preserve framework metadata
      });
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
 * Wrap a generic agent loop to optimize messages before LLM calls
 * 
 * Returns a function that wraps the original provider call with optimization.
 * 
 * @example
 * ```ts
 * // Original agent loop
 * async function myAgentLoop(request: MyRequest): Promise<MyResponse> {
 *   return await myProvider.chat(request);
 * }
 * 
 * // Wrapped with Spectyra optimization
 * const optimizedLoop = await wrapGenericAgentLoop({
 *   toMessages: (req) => req.messages,
 *   fromMessages: (msgs, orig) => ({ ...orig, messages: msgs }),
 *   callProvider: myAgentLoop,
 *   getAssistantText: (res) => res.text,
 *   repoContext: { files: [...] },
 *   mode: "code",
 *   spectyraConfig: {
 *     apiEndpoint: "https://spectyra.up.railway.app/v1",
 *     apiKey: process.env.SPECTYRA_API_KEY,
 *   },
 * });
 * 
 * // Use wrapped function
 * const response = await optimizedLoop(myRequest);
 * ```
 */
export async function wrapGenericAgentLoop<TReq, TRes>(
  cfg: WrapGenericAgentLoopConfig<TReq, TRes>
): Promise<(req: TReq) => Promise<TRes>> {
  const {
    toMessages,
    fromMessages,
    callProvider,
    repoContext,
    mode = "auto",
    runId,
    spectyraConfig,
  } = cfg;
  
  return async (req: TReq): Promise<TRes> => {
    // Extract messages from request
    const originalMessages = toMessages(req);
    
    // Convert to internal format
    const chatMessages = toChatMessages(originalMessages);
    
    // Optimize messages
    const optimized = await optimizeAgentMessages({
      messages: chatMessages,
      repoContext,
      mode,
      runId,
      apiEndpoint: spectyraConfig?.apiEndpoint,
      apiKey: spectyraConfig?.apiKey,
    });
    
    // Convert back to generic format
    const optimizedMessages = fromChatMessages(optimized.messages, originalMessages);
    
    // Reconstruct request with optimized messages
    const optimizedReq = fromMessages(optimizedMessages, req);
    
    // Call provider with optimized request
    return await callProvider(optimizedReq);
  };
}
