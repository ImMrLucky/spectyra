/**
 * Provider Factory - Creates provider instances with custom API keys (BYOK)
 * 
 * This allows users to provide their own provider API keys via X-PROVIDER-KEY header.
 * Keys are never stored server-side.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatProvider } from "./types.js";
import type { Message, Usage } from "@spectyra/shared";
import { estimateUsage } from "./tokenEstimate.js";

/**
 * Create a provider instance with a custom API key (BYOK).
 * 
 * @param providerName Provider name (e.g., "openai", "anthropic")
 * @param apiKey Custom API key from user (BYOK)
 * @returns Provider instance or undefined if provider not found
 */
export function createProviderWithKey(
  providerName: string,
  apiKey: string
): ChatProvider | undefined {
  if (!apiKey) {
    return undefined;
  }

  switch (providerName.toLowerCase()) {
    case "openai": {
      return new OpenAIProviderWithKey(apiKey);
    }
    case "anthropic": {
      return new AnthropicProviderWithKey(apiKey);
    }
    case "gemini": {
      return new GeminiProviderWithKey(apiKey);
    }
    case "grok": {
      return new GrokProviderWithKey(apiKey);
    }
    default:
      return undefined;
  }
}

/**
 * Wrapper classes that accept API key in constructor
 */

class OpenAIProviderWithKey implements ChatProvider {
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
  
  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
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

class AnthropicProviderWithKey implements ChatProvider {
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
  
  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
    });
  }
  
  async chat(messages: Message[], model: string, maxOutputTokens?: number): Promise<{ text: string; usage?: Usage }> {
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

class GeminiProviderWithKey implements ChatProvider {
  name = "gemini";
  models = [
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-pro",
  ];
  supportsUsage = false;
  
  private client: any; // GoogleGenerativeAI client
  
  constructor(apiKey: string) {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    this.client = new GoogleGenerativeAI(apiKey);
  }
  
  async chat(messages: any[], model: string, maxOutputTokens?: number): Promise<{ text: string; usage?: any }> {
    const genModel = this.client.getGenerativeModel({ model });
    
    const systemMessage = messages.find((m: any) => m.role === "system");
    const conversationMessages = messages.filter((m: any) => m.role !== "system");
    
    const chat = genModel.startChat({
      history: conversationMessages.slice(0, -1).map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
      systemInstruction: systemMessage?.content,
    });
    
    const lastMessage = conversationMessages[conversationMessages.length - 1];
    const result = await chat.sendMessage(lastMessage.content, {
      ...(maxOutputTokens ? { generationConfig: { maxOutputTokens } } : {}),
    });
    const response = await result.response;
    const text = response.text();
    
    // Estimate usage
    const { estimateUsage } = require("./tokenEstimate.js");
    const usage = estimateUsage(messages, text, model);
    
    return { text, usage };
  }
}

class GrokProviderWithKey implements ChatProvider {
  name = "grok";
  models = [
    "grok-beta",
    "grok-2",
  ];
  supportsUsage = false;
  
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async chat(messages: Message[], model: string, maxOutputTokens?: number): Promise<{ text: string; usage?: Usage }> {
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
