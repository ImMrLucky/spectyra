import type { OptimizerProvider } from "./optimizer";
import type { ChatMessage } from "./unitize";
import type { ChatProvider as LLMChatProvider } from "../llm/types";
import type { Message } from "@spectyra/shared";

/**
 * Adapter to convert LLM ChatProvider to Optimizer Provider
 */
export function createOptimizerProvider(llmProvider: LLMChatProvider): OptimizerProvider {
  return {
    id: llmProvider.name,
    chat: async (args) => {
      // Convert ChatMessage[] to Message[] (filter out tool role messages)
      const messages: Message[] = args.messages
        .filter(m => m.role !== "tool") // LLM providers don't support tool role
        .map(m => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));
      
      const result = await llmProvider.chat(messages, args.model, args.maxOutputTokens);
      
      return {
        text: result.text,
        usage: result.usage ? {
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
          total_tokens: result.usage.total_tokens,
          estimated: result.usage.estimated,
        } : undefined,
      };
    },
  };
}
