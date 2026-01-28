/**
 * Embedder Registry
 * 
 * Manages embedding service providers. Spectyra uses FREE embeddings only.
 * 
 * Providers (all FREE):
 * - "local": In-process embeddings using Transformers.js (recommended)
 * - "http": External HTTP service (e.g., HuggingFace Inference API)
 * - "disabled": No embeddings (uses zero vectors, for testing)
 * 
 * Configuration:
 * - EMBEDDINGS_PROVIDER: "local" | "http" | "disabled" (default: "local")
 * - EMBEDDINGS_HTTP_URL: URL for HTTP provider (HuggingFace API or self-hosted)
 * - EMBEDDINGS_HTTP_TOKEN: Auth token for HTTP provider
 * - EMBEDDINGS_MODEL: Model name (default: Xenova/bge-small-en-v1.5)
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
   * 
   * ALL providers are FREE. Spectyra never pays for embeddings.
   */
  private async init() {
    if (this.initialized) return;
    this.initialized = true;
    
    const provider = config.embeddings.provider;
    
    // "disabled" provider - returns zero vectors
    if (provider === "disabled") {
      this.register("disabled", new DisabledEmbeddingService());
      safeLog("warn", "Embeddings DISABLED - semantic features will not work properly");
      return;
    }
    
    // "local" provider - in-process using Transformers.js (FREE)
    if (provider === "local") {
      try {
        const { LocalEmbeddingService, isLocalEmbeddingAvailable } = await import("./localEmbeddingService.js");
        if (await isLocalEmbeddingAvailable()) {
          this.register("local", new LocalEmbeddingService());
          safeLog("info", "Local embeddings registered (FREE, in-process Transformers.js)", {
            model: config.embeddings.model || "Xenova/bge-small-en-v1.5",
          });
          return;
        }
      } catch (e: any) {
        safeLog("warn", "Local embeddings not available, trying HTTP fallback", { error: e.message });
      }
    }
    
    // "http" provider - external service (FREE with HuggingFace Inference API)
    if (provider === "http" || provider === "local") {
      try {
        const { HttpEmbeddingService } = await import("./httpEmbeddingService.js");
        const httpService = new HttpEmbeddingService();
        this.register("http", httpService);
        if (provider === "local") {
          this.register("local", httpService); // Fallback
        }
        safeLog("info", "HTTP embeddings registered (FREE)", {
          url: config.embeddings.httpUrl,
          model: config.embeddings.model,
        });
      } catch (e: any) {
        safeLog("error", "HTTP embedder failed to initialize", { error: e.message });
      }
    }
    
    // If nothing registered, use disabled as last resort
    if (this.embedders.size === 0) {
      this.register("disabled", new DisabledEmbeddingService());
      safeLog("error", "No embedding service available! Using disabled (zero vectors).");
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
 * Disabled embedding service - returns zero vectors
 * Used when embeddings are disabled or unavailable
 */
class DisabledEmbeddingService implements EmbeddingService {
  async embed(texts: string[]): Promise<number[][]> {
    // Return 384-dimensional zero vectors (matches bge-small-en-v1.5)
    return texts.map(() => new Array(384).fill(0));
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
