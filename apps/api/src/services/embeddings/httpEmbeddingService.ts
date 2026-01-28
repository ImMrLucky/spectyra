/**
 * HTTP Embedding Service
 * 
 * Calls a local or remote HTTP embedding service (e.g., HuggingFace TEI).
 * This is the default for Spectyra-hosted embeddings (free, open-source).
 * 
 * Supports:
 * - HuggingFace Text Embeddings Inference (TEI)
 * - Any OpenAI-compatible embedding API
 * - Custom embedding endpoints
 */

import { config } from "../../config.js";
import { safeLog } from "../../utils/redaction.js";
import type { EmbeddingService } from "../optimizer/optimizer.js";
import { getEmbeddingCache, setEmbeddingCache } from "./embeddingCache.js";
import crypto from "node:crypto";

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Normalize text for consistent cache keys and embedding quality
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/\n+/g, " ") // Replace newlines
    .slice(0, 8192); // Limit length for models
}

/**
 * Compute cache key for embedding
 */
function computeCacheKey(text: string, model: string, provider: string): string {
  const normalizedText = normalizeText(text);
  const input = `${provider}:${model}:${normalizedText}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Sleep for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * HTTP Embedding Service implementation
 */
export class HttpEmbeddingService implements EmbeddingService {
  private baseUrl: string;
  private token: string;
  private model: string;
  private cacheEnabled: boolean;
  
  constructor(options?: { baseUrl?: string; token?: string; model?: string }) {
    this.baseUrl = options?.baseUrl || config.embeddings.httpUrl;
    this.token = options?.token || config.embeddings.httpToken;
    this.model = options?.model || config.embeddings.model;
    this.cacheEnabled = config.embeddings.cacheEnabled;
    
    safeLog("info", "HttpEmbeddingService initialized", {
      baseUrl: this.baseUrl,
      model: this.model,
      cacheEnabled: this.cacheEnabled,
    });
  }
  
  /**
   * Embed a batch of texts
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    
    // Normalize all texts
    const normalizedTexts = texts.map(normalizeText);
    
    // Check cache for each text
    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];
    
    if (this.cacheEnabled) {
      for (let i = 0; i < normalizedTexts.length; i++) {
        const cacheKey = computeCacheKey(normalizedTexts[i], this.model, "http");
        const cached = await getEmbeddingCache(cacheKey);
        if (cached) {
          results[i] = cached;
        } else {
          uncachedIndices.push(i);
          uncachedTexts.push(normalizedTexts[i]);
        }
      }
      
      safeLog("info", "Embedding cache lookup", {
        total: texts.length,
        cached: texts.length - uncachedTexts.length,
        uncached: uncachedTexts.length,
      });
      
      if (uncachedTexts.length === 0) {
        // All results from cache
        return results as number[][];
      }
    } else {
      // No caching - process all
      uncachedIndices.push(...texts.map((_, i) => i));
      uncachedTexts.push(...normalizedTexts);
    }
    
    // Fetch embeddings for uncached texts
    const embeddings = await this.fetchEmbeddings(uncachedTexts);
    
    // Cache the new embeddings and merge results
    for (let i = 0; i < uncachedIndices.length; i++) {
      const originalIndex = uncachedIndices[i];
      const embedding = embeddings[i];
      results[originalIndex] = embedding;
      
      if (this.cacheEnabled && embedding) {
        const cacheKey = computeCacheKey(uncachedTexts[i], this.model, "http");
        await setEmbeddingCache(cacheKey, embedding);
      }
    }
    
    return results as number[][];
  }
  
  /**
   * Fetch embeddings from HTTP endpoint with retries
   */
  private async fetchEmbeddings(texts: string[]): Promise<number[][]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.doFetch(texts);
      } catch (error: any) {
        lastError = error;
        safeLog("warn", `Embedding request failed (attempt ${attempt}/${MAX_RETRIES})`, {
          error: error.message,
          baseUrl: this.baseUrl,
        });
        
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }
    
    throw new Error(`Embedding service unavailable after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }
  
  /**
   * Perform the actual HTTP request
   */
  private async doFetch(texts: string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    
    try {
      // Try TEI format first (HuggingFace Text Embeddings Inference)
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { "Authorization": `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          inputs: texts,
          // TEI options
          normalize: true,
          truncate: true,
        }),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        // Try OpenAI-compatible format as fallback
        return await this.fetchOpenAICompatible(texts);
      }
      
      const data = await response.json() as unknown;
      
      // Handle TEI response format (array of arrays)
      if (Array.isArray(data) && Array.isArray((data as number[][])[0])) {
        return data as number[][];
      }
      
      // Handle OpenAI-compatible format
      const dataObj = data as { data?: { embedding: number[] }[] };
      if (dataObj.data && Array.isArray(dataObj.data)) {
        return dataObj.data.map((item) => item.embedding);
      }
      
      throw new Error(`Unexpected embedding response format: ${JSON.stringify(data).slice(0, 200)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Fallback to OpenAI-compatible embedding endpoint
   */
  private async fetchOpenAICompatible(texts: string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    
    try {
      // OpenAI-compatible endpoint is typically at /v1/embeddings
      const url = this.baseUrl.endsWith("/v1/embeddings") 
        ? this.baseUrl 
        : `${this.baseUrl}/v1/embeddings`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { "Authorization": `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error (${response.status}): ${errorText.slice(0, 200)}`);
      }
      
      const data = await response.json() as { data?: { index: number; embedding: number[] }[] };
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error(`Invalid OpenAI-compatible response: ${JSON.stringify(data).slice(0, 200)}`);
      }
      
      // Sort by index to ensure correct order
      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map((item) => item.embedding);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create HTTP embedding service with default configuration
 */
export function createHttpEmbeddingService(): HttpEmbeddingService {
  return new HttpEmbeddingService();
}
