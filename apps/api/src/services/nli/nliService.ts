/**
 * NLI (Natural Language Inference) Service
 * 
 * Provides contradiction/entailment classification for text pairs.
 * Used by the optimizer for enhanced edge classification in the semantic graph.
 * 
 * Supports:
 * - Local HTTP service (FastAPI with MNLI model)
 * - Remote HTTP endpoint
 * - Disabled mode (falls back to heuristic classification)
 * 
 * Configuration:
 * - NLI_PROVIDER: "local" | "http" | "disabled" (default: "local")
 * - NLI_HTTP_URL: URL of NLI service (default: http://localhost:8082)
 * - NLI_MODEL: Model name (default: microsoft/deberta-v3-large-mnli)
 */

import { config } from "../../config.js";
import { safeLog } from "../../utils/redaction.js";

// NLI Labels
export type NliLabel = "entailment" | "contradiction" | "neutral";

// NLI result for a single pair
export interface NliResult {
  label: NliLabel;
  confidence: number;
  scores?: Record<string, number>;
}

// NLI pair input
export interface NliPair {
  premise: string;
  hypothesis: string;
}

// NLI service interface
export interface NliService {
  /**
   * Classify a single premise-hypothesis pair
   */
  classify(pair: NliPair): Promise<NliResult>;
  
  /**
   * Classify multiple pairs in batch
   */
  classifyBatch(pairs: NliPair[]): Promise<NliResult[]>;
  
  /**
   * Check if NLI service is available
   */
  isAvailable(): Promise<boolean>;
}

// Constants
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;
const MAX_TEXT_LENGTH = 512;

/**
 * Normalize text for NLI
 */
function normalizeNliText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_TEXT_LENGTH);
}

/**
 * HTTP NLI Service - calls a local or remote NLI endpoint
 */
export class HttpNliService implements NliService {
  private baseUrl: string;
  private token: string;
  private model: string;
  private timeoutMs: number;
  private available: boolean | null = null;
  
  constructor(options?: { baseUrl?: string; token?: string; model?: string }) {
    this.baseUrl = options?.baseUrl || config.nli.httpUrl;
    this.token = options?.token || config.nli.httpToken;
    this.model = options?.model || config.nli.model;
    this.timeoutMs = config.nli.timeoutMs;
    
    safeLog("info", "HttpNliService initialized", {
      baseUrl: this.baseUrl,
      model: this.model,
    });
  }
  
  async classify(pair: NliPair): Promise<NliResult> {
    const results = await this.classifyBatch([pair]);
    return results[0];
  }
  
  async classifyBatch(pairs: NliPair[]): Promise<NliResult[]> {
    if (pairs.length === 0) {
      return [];
    }
    
    // Normalize inputs
    const normalizedPairs = pairs.map(p => ({
      premise: normalizeNliText(p.premise),
      hypothesis: normalizeNliText(p.hypothesis),
    }));
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.doFetch(normalizedPairs);
      } catch (error: any) {
        lastError = error;
        safeLog("warn", `NLI request failed (attempt ${attempt}/${MAX_RETRIES})`, {
          error: error.message,
          baseUrl: this.baseUrl,
        });
        
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
      }
    }
    
    // Fall back to neutral for all pairs on failure
    safeLog("warn", "NLI service unavailable, returning neutral for all pairs", {
      error: lastError?.message,
    });
    
    return pairs.map(() => ({
      label: "neutral" as NliLabel,
      confidence: 0.33,
    }));
  }
  
  private async doFetch(pairs: NliPair[]): Promise<NliResult[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    
    try {
      const response = await fetch(`${this.baseUrl}/nli`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { "Authorization": `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          pairs,
          model: this.model,
        }),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NLI API error (${response.status}): ${errorText.slice(0, 200)}`);
      }
      
      const data = await response.json() as { 
        results?: { label: string; confidence?: number; scores?: Record<string, number> }[] 
      };
      
      // Expected format: { results: [{ label, confidence, scores? }] }
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error(`Invalid NLI response format: ${JSON.stringify(data).slice(0, 200)}`);
      }
      
      return data.results.map((r) => ({
        label: r.label as NliLabel,
        confidence: r.confidence || 0.5,
        scores: r.scores,
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  async isAvailable(): Promise<boolean> {
    if (this.available !== null) {
      return this.available;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      this.available = response.ok;
      return this.available;
    } catch (error: any) {
      safeLog("warn", "NLI health check failed", { error: error.message });
      this.available = false;
      return false;
    }
  }
}

/**
 * Disabled NLI Service - returns neutral for all pairs
 */
export class DisabledNliService implements NliService {
  async classify(pair: NliPair): Promise<NliResult> {
    return { label: "neutral", confidence: 0.33 };
  }
  
  async classifyBatch(pairs: NliPair[]): Promise<NliResult[]> {
    return pairs.map(() => ({ label: "neutral", confidence: 0.33 }));
  }
  
  async isAvailable(): Promise<boolean> {
    return false;
  }
}

// Singleton instance
let nliServiceInstance: NliService | null = null;
let nliServiceInitPromise: Promise<NliService> | null = null;

/**
 * Get the configured NLI service (async version for proper initialization)
 */
export async function getNliServiceAsync(): Promise<NliService> {
  if (nliServiceInstance) {
    return nliServiceInstance;
  }
  
  if (nliServiceInitPromise) {
    return nliServiceInitPromise;
  }
  
  nliServiceInitPromise = (async () => {
    const provider = config.nli.provider;
    
    // "local" - use in-process Transformers.js (FREE)
    if (provider === "local") {
      try {
        const { LocalNliService, isLocalNliAvailable } = await import("./localNliService.js");
        if (await isLocalNliAvailable()) {
          nliServiceInstance = new LocalNliService();
          safeLog("info", "Local NLI service initialized (FREE, in-process Transformers.js)", {
            model: config.nli.model || "Xenova/distilbert-base-uncased-mnli",
          });
          return nliServiceInstance;
        }
      } catch (e: any) {
        safeLog("warn", "Local NLI not available, trying HTTP fallback", { error: e.message });
      }
    }
    
    // "http" - external HTTP service
    if (provider === "http" || provider === "local") {
      nliServiceInstance = new HttpNliService();
      safeLog("info", "HTTP NLI service initialized", {
        url: config.nli.httpUrl,
        model: config.nli.model,
      });
      return nliServiceInstance;
    }
    
    // "disabled" - return neutral for everything
    nliServiceInstance = new DisabledNliService();
    safeLog("info", "NLI service disabled (using heuristic contradiction detection)");
    return nliServiceInstance;
  })();
  
  return nliServiceInitPromise;
}

/**
 * Get the configured NLI service (sync version - uses disabled if not initialized)
 */
export function getNliService(): NliService {
  if (nliServiceInstance) {
    return nliServiceInstance;
  }
  
  const provider = config.nli.provider;
  
  // For sync access, we can only use HTTP or disabled
  // Local requires async initialization
  switch (provider) {
    case "http":
      nliServiceInstance = new HttpNliService();
      break;
    case "local":
      // Trigger async init in background, return disabled for now
      getNliServiceAsync().catch(() => {});
      nliServiceInstance = new DisabledNliService();
      break;
    case "disabled":
    default:
      nliServiceInstance = new DisabledNliService();
      break;
  }
  
  safeLog("info", "NLI service initialized", { provider });
  return nliServiceInstance;
}

/**
 * Get NLI service information
 */
export function getNliServiceInfo(): {
  provider: string;
  model: string;
  httpUrl: string;
  enabled: boolean;
} {
  return {
    provider: config.nli.provider,
    model: config.nli.model,
    httpUrl: config.nli.httpUrl,
    enabled: config.nli.provider !== "disabled",
  };
}

/**
 * Helper to classify a pair with fallback
 */
export async function classifyPairWithFallback(
  premise: string,
  hypothesis: string
): Promise<NliResult> {
  const service = getNliService();
  
  try {
    return await service.classify({ premise, hypothesis });
  } catch (error: any) {
    safeLog("warn", "NLI classification failed, using neutral", { error: error.message });
    return { label: "neutral", confidence: 0.33 };
  }
}
