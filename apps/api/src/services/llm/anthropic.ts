import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config.js";
import type { ChatProvider } from "./types.js";
import type { Message, Usage } from "@spectyra/shared";
import { estimateUsage } from "./tokenEstimate.js";

export class AnthropicProvider implements ChatProvider {
  name = "anthropic";
  models = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ];
  supportsUsage = true;
  
  private client: Anthropic;
  
  constructor() {
    this.client = new Anthropic({
      apiKey: config.providers.anthropic.apiKey,
    });
  }
  
  async chat(messages: Message[], model: string, maxOutputTokens?: number): Promise<{ text: string; usage?: Usage }> {
    // Anthropic requires system message separately
    const systemMessage = messages.find(m => m.role === "system");
    const conversationMessages = messages.filter(m => m.role !== "system");
    
    const response = await this.client.messages.create({
      model,
      max_tokens: maxOutputTokens || 4096,
      system: systemMessage?.content,
      messages: conversationMessages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    });
    
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const usage: Usage | undefined = response.usage ? {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      estimated: false,
    } : undefined;
    
    return { text, usage };
  }
}
