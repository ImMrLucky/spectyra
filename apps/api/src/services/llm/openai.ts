import OpenAI from "openai";
import { config } from "../../config.js";
import type { ChatProvider } from "./types.js";
import type { Message, Usage } from "@spectyra/shared";
import { estimateUsage } from "./tokenEstimate.js";

export class OpenAIProvider implements ChatProvider {
  name = "openai";
  models = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
  ];
  supportsUsage = true;
  
  private client: OpenAI;
  
  constructor() {
    this.client = new OpenAI({
      apiKey: config.providers.openai.apiKey,
    });
  }
  
  async chat(messages: Message[], model: string, maxOutputTokens?: number): Promise<{ text: string; usage?: Usage }> {
    const response = await this.client.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
    });
    
    const text = response.choices[0]?.message?.content || "";
    const usage: Usage | undefined = response.usage ? {
      input_tokens: response.usage.prompt_tokens,
      output_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
      estimated: false,
    } : undefined;
    
    return { text, usage };
  }
}
