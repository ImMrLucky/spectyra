import { config } from "../../config.js";
import type { ChatProvider } from "./types.js";
import type { Message, Usage } from "@spectyra/shared";
import { estimateUsage } from "./tokenEstimate.js";

// Grok API implementation (using xAI's API when available)
// For MVP, we'll use a fetch-based approach
export class GrokProvider implements ChatProvider {
  name = "grok";
  models = [
    "grok-beta",
    "grok-2",
  ];
  supportsUsage = false; // Grok API may not return usage reliably
  
  private apiKey: string;
  
  constructor() {
    this.apiKey = config.providers.grok.apiKey;
  }
  
  async chat(messages: Message[], model: string, maxOutputTokens?: number): Promise<{ text: string; usage?: Usage }> {
    // xAI Grok API endpoint (adjust as needed)
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Grok API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const text = data.choices[0]?.message?.content || "";
    
    // Estimate usage
    const usage = estimateUsage(messages, text, model);
    
    return { text, usage };
  }
}
