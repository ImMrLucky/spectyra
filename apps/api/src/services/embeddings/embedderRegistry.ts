/**
 * Embedder Registry
 * 
 * Manages embedding service providers. In production, Spectyra uses local/HTTP
 * open-source embeddings (TEI) to avoid paying for external API calls.
 * 
 * Providers:
 * - "local" / "http": HTTP embedding service (default, calls TEI)
 * - "openai": OpenAI embeddings (legacy, only for dev/testing when EMBEDDINGS_PROVIDER=openai)
 * 
 * Configuration:
 * - EMBEDDINGS_PROVIDER: "local" | "http" | "openai" (default: "local")
 * - EMBEDDINGS_HTTP_URL: URL of embedding service (default: http://localhost:8081)
 * - EMBEDDINGS_MODEL: Model to use (default: BAAI/bge-large-en-v1.5)
 */

import { config } from "../../config.js";
import { safeLog } from "../../utils/redaction.js";
import type { EmbeddingService } from "../optimizer/optimizer.js";

class EmbedderRegistry {
  private embedders: Map<string, EmbeddingService> = new Map();
  private defaultProvider: string;
  private initialized: boolean = false;
  
  constructor() {
    this.defaultProvider = config.embeddings.provider;
  }
  
  /**
   * Lazy initialization of embedders
   */
  private async init() {
    if (this.initialized) return;
    this.initialized = true;
    
    // Initialize HTTP/Local embedder (default)
    try {
      const { HttpEmbeddingService } = await import("./httpEmbeddingService.js");
      const httpService = new HttpEmbeddingService();
      this.register("local", httpService);
      this.register("http", httpService);
      safeLog("info", "HTTP/Local embedder registered", {
        url: config.embeddings.httpUrl,
        model: config.embeddings.model,
      });
    } catch (e: any) {
      safeLog("warn", "HTTP embedder not available", { error: e.message });
    }
    
    // Initialize OpenAI embedder (legacy, for dev/testing only)
    if (config.embeddings.provider === "openai" || config.allowEnvProviderKeys) {
      try {
        const { OpenAIEmbeddings } = await import("./openaiEmbeddings.js");
        this.register("openai", new OpenAIEmbeddingServiceWrapper());
        safeLog("info", "OpenAI embedder registered (dev/testing mode)");
      } catch (e: any) {
        safeLog("warn", "OpenAI embedder not available", { error: e.message });
      }
    }
  }
  
  register(name: string, embedder: EmbeddingService) {
    this.embedders.set(name, embedder);
  }
  
  async get(name: string): Promise<EmbeddingService | undefined> {
    await this.init();
    return this.embedders.get(name);
  }
  
  async getDefault(): Promise<EmbeddingService> {
    await this.init();
    
    // Try configured default provider
    const defaultEmbedder = this.embedders.get(this.defaultProvider);
    if (defaultEmbedder) {
      return defaultEmbedder;
    }
    
    // Fallback to local/http
    const httpEmbedder = this.embedders.get("local") || this.embedders.get("http");
    if (httpEmbedder) {
      return httpEmbedder;
    }
    
    // Last resort: any available embedder
    const firstEmbedder = this.embedders.values().next().value;
    if (firstEmbedder) {
      return firstEmbedder;
    }
    
    throw new Error("No embedding service available. Check EMBEDDINGS_PROVIDER configuration.");
  }
  
  /**
   * Get configured provider name
   */
  getConfiguredProvider(): string {
    return this.defaultProvider;
  }
}

/**
 * Wrapper for OpenAI embeddings (legacy compatibility)
 */
class OpenAIEmbeddingServiceWrapper implements EmbeddingService {
  private client: any | null = null;
  
  private async getClient() {
    if (!this.client) {
      const { OpenAIEmbeddings } = await import("./openaiEmbeddings.js");
      this.client = new OpenAIEmbeddings();
    }
    return this.client;
  }
  
  async embed(texts: string[]): Promise<number[][]> {
    const client = await this.getClient();
    return client.embedBatch(texts);
  }
}

export const embedderRegistry = new EmbedderRegistry();

/**
 * Get an embedder by name (async)
 * 
 * @param name Provider name ("local", "http", "openai") - defaults to configured provider
 */
export async function getEmbedderAsync(name?: string): Promise<EmbeddingService> {
  const providerName = name || config.embeddings.provider;
  const embedder = await embedderRegistry.get(providerName);
  if (!embedder) {
    // Fallback to default
    return embedderRegistry.getDefault();
  }
  return embedder;
}

/**
 * Get embedder (sync wrapper for backward compatibility)
 * 
 * NOTE: This is deprecated. Use getEmbedderAsync() instead.
 * This function initializes lazily and may throw if called before init.
 * 
 * @param name Provider name (ignored in new implementation, uses configured provider)
 */
export function getEmbedder(name: string = "openai"): EmbeddingService {
  // Return a wrapper that lazily initializes
  return {
    async embed(texts: string[]): Promise<number[][]> {
      const embedder = await getEmbedderAsync();
      return embedder.embed(texts);
    }
  };
}

/**
 * Get embedding service information
 */
export function getEmbeddingServiceInfo(): {
  provider: string;
  model: string;
  httpUrl: string;
  cacheEnabled: boolean;
} {
  return {
    provider: config.embeddings.provider,
    model: config.embeddings.model,
    httpUrl: config.embeddings.httpUrl,
    cacheEnabled: config.embeddings.cacheEnabled,
  };
}
