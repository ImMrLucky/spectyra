import { encoding_for_model } from "tiktoken";
import type { Message, Usage } from "@spectyra/shared";

// Fallback token estimation using tiktoken (OpenAI's tokenizer)
// This is an approximation for providers that don't return usage
export function estimateTokens(text: string, model: string = "gpt-4"): number {
  try {
    const enc = encoding_for_model(model as any);
    const tokens = enc.encode(text);
    enc.free();
    return tokens.length;
  } catch {
    // Fallback: rough estimate (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}

export function estimateUsage(messages: Message[], responseText: string, model: string = "gpt-4"): Usage {
  const inputText = messages.map(m => `${m.role}: ${m.content}`).join("\n");
  const inputTokens = estimateTokens(inputText, model);
  const outputTokens = estimateTokens(responseText, model);
  
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    estimated: true,
  };
}
