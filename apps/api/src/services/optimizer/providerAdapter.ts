import type { ChatProvider as OptimizerChatProvider } from "./optimizer";
import type { ChatMessage } from "./unitize";
import type { ChatProvider as LLMChatProvider } from "../llm/types";
import type { Message } from "@spectyra/shared";

/**
 * Adapter to convert LLM ChatProvider to Optimizer ChatProvider
 */
export function createOptimizerProvider(llmProvider: LLMChatProvider): OptimizerChatProvider {
  return {
    id: llmProvider.name,
    chat: async (args) => {
      // Convert ChatMessage[] to Message[]
      const messages: Message[] = args.messages.map(m => ({
        role: m.role,
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
