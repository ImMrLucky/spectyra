import type { ChatProvider } from "./types.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { GrokProvider } from "./grok.js";

class ProviderRegistry {
  private providers: Map<string, ChatProvider> = new Map();
  
  constructor() {
    // Initialize providers
    try {
      this.register(new OpenAIProvider());
    } catch (e) {
      console.warn("OpenAI provider not available:", e);
    }
    
    try {
      this.register(new AnthropicProvider());
    } catch (e) {
      console.warn("Anthropic provider not available:", e);
    }
    
    try {
      this.register(new GeminiProvider());
    } catch (e) {
      console.warn("Gemini provider not available:", e);
    }
    
    try {
      this.register(new GrokProvider());
    } catch (e) {
      console.warn("Grok provider not available:", e);
    }
  }
  
  register(provider: ChatProvider) {
    this.providers.set(provider.name, provider);
  }
  
  get(name: string): ChatProvider | undefined {
    return this.providers.get(name);
  }
  
  async listProviders() {
    const providers = Array.from(this.providers.values());
    return providers.map(p => ({
      name: p.name,
      models: p.models,
      supportsUsage: p.supportsUsage,
    }));
  }
}

export const providerRegistry = new ProviderRegistry();
