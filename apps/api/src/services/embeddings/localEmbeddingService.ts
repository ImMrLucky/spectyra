/**
 * Local Embedding Service using Transformers.js
 * 
 * Runs embeddings directly in Node.js - no external service needed!
 * Uses HuggingFace models via @xenova/transformers.
 * 
 * Benefits:
 * - FREE (no API costs)
 * - No separate service to deploy
 * - Works offline
 * 
 * Tradeoffs:
 * - First load is slow (downloads model ~130MB)
 * - Uses CPU (no GPU acceleration in Node.js)
 * - Uses more memory on API server (~500MB for model)
 */

import { config } from "../../config.js";
import { safeLog } from "../../utils/redaction.js";
import { getEmbeddingCache, setEmbeddingCache } from "./embeddingCache.js";
import type { EmbeddingService } from "../optimizer/optimizer.js";
import crypto from "crypto";

// Lazy-loaded pipeline
let pipeline: any = null;
let extractor: any = null;
let initPromise: Promise<void> | null = null;

// Model to use - smaller models are faster
const DEFAULT_MODEL = "Xenova/bge-small-en-v1.5"; // 130MB, good quality
// Alternatives:
// "Xenova/all-MiniLM-L6-v2" - 90MB, faster but lower quality
// "Xenova/bge-base-en-v1.5" - 440MB, better quality

/**
 * Initialize the embedding pipeline (lazy, happens on first use)
 */
async function initPipeline(): Promise<void> {
  if (extractor) return;
  
  if (initPromise) {
    await initPromise;
    return;
  }
  
  initPromise = (async () => {
    safeLog("info", "Loading local embedding model (first time may take a minute)...");
    const startTime = Date.now();
    
    try {
      // Dynamic import to avoid issues if package not installed
      const { pipeline: pipelineFn } = await import("@xenova/transformers");
      pipeline = pipelineFn;
      
      // Create feature extraction pipeline
      const modelName = config.embeddings.model?.includes("Xenova/") 
        ? config.embeddings.model 
        : DEFAULT_MODEL;
      
      extractor = await pipeline("feature-extraction", modelName, {
        // Use quantized model for faster inference
        quantized: true,
      });
      
      const loadTime = Date.now() - startTime;
      safeLog("info", `Local embedding model loaded in ${loadTime}ms`, { model: modelName });
    } catch (error: any) {
      safeLog("error", "Failed to load local embedding model", { error: error.message });
      throw error;
    }
  })();
  
  await initPromise;
}

/**
 * Generate a cache key for text
 */
function getCacheKey(text: string): string {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, " ");
  return `emb:local:${crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16)}`;
}

/**
 * Local Embedding Service - runs directly in Node.js
 */
export class LocalEmbeddingService implements EmbeddingService {
  /**
   * Generate embeddings for texts
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    
    // Check cache first
    const results: (number[] | null)[] = [];
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];
    
    if (config.embeddings.cacheEnabled) {
      for (let i = 0; i < texts.length; i++) {
        const cacheKey = getCacheKey(texts[i]);
        const cached = await getEmbeddingCache(cacheKey);
        if (cached) {
          results[i] = cached;
        } else {
          results[i] = null;
          uncachedIndices.push(i);
          uncachedTexts.push(texts[i]);
        }
      }
      
      if (uncachedTexts.length === 0) {
        safeLog("info", `All ${texts.length} embeddings served from cache`);
        return results as number[][];
      }
    } else {
      for (let i = 0; i < texts.length; i++) {
        results[i] = null;
        uncachedIndices.push(i);
        uncachedTexts.push(texts[i]);
      }
    }
    
    // Initialize pipeline if needed
    await initPipeline();
    
    // Generate embeddings for uncached texts
    const embeddings: number[][] = [];
    
    for (const text of uncachedTexts) {
      try {
        // Run the model
        const output = await extractor(text, {
          pooling: "mean",
          normalize: true,
        });
        
        // Convert to array
        const embedding = Array.from(output.data) as number[];
        embeddings.push(embedding);
      } catch (error: any) {
        safeLog("error", "Local embedding failed", { error: error.message, textLength: text.length });
        // Return zero vector on error
        embeddings.push(new Array(384).fill(0));
      }
    }
    
    // Cache the new embeddings and merge results
    for (let i = 0; i < uncachedIndices.length; i++) {
      const originalIndex = uncachedIndices[i];
      const embedding = embeddings[i];
      results[originalIndex] = embedding;
      
      if (config.embeddings.cacheEnabled) {
        const cacheKey = getCacheKey(texts[originalIndex]);
        const ttl = config.embeddings.cacheTtlDays * 24 * 60 * 60;
        await setEmbeddingCache(cacheKey, embedding, ttl).catch(() => {});
      }
    }
    
    safeLog("info", `Generated ${uncachedTexts.length} embeddings locally, ${texts.length - uncachedTexts.length} from cache`);
    
    return results as number[][];
  }
}

/**
 * Check if local embeddings are available
 */
export async function isLocalEmbeddingAvailable(): Promise<boolean> {
  try {
    await import("@xenova/transformers");
    return true;
  } catch {
    return false;
  }
}
