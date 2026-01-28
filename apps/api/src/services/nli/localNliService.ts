/**
 * Local NLI Service using Transformers.js
 * 
 * Runs NLI (Natural Language Inference) directly in Node.js - no external service needed!
 * Uses HuggingFace models via @xenova/transformers.
 * 
 * Benefits:
 * - FREE (no API costs)
 * - No separate service to deploy
 * - Works offline
 * 
 * Tradeoffs:
 * - First load is slow (downloads model)
 * - Uses CPU (no GPU acceleration in Node.js)
 * - Uses more memory on API server
 */

import { config } from "../../config.js";
import { safeLog } from "../../utils/redaction.js";
import type { NliService, NliPair, NliResult, NliLabel } from "./nliService.js";

// Lazy-loaded pipeline
let classifier: any = null;
let initPromise: Promise<void> | null = null;

// Model to use - smaller model for NLI
const DEFAULT_MODEL = "Xenova/distilbert-base-uncased-mnli"; // ~260MB, fast
// Alternatives:
// "Xenova/nli-deberta-v3-small" - ~180MB, good accuracy
// "Xenova/roberta-large-mnli" - ~1.4GB, best accuracy but slow

// Label mapping from model output to our types
const LABEL_MAP: Record<string, NliLabel> = {
  "ENTAILMENT": "entailment",
  "CONTRADICTION": "contradiction", 
  "NEUTRAL": "neutral",
  "entailment": "entailment",
  "contradiction": "contradiction",
  "neutral": "neutral",
};

/**
 * Initialize the NLI pipeline (lazy, happens on first use)
 */
async function initPipeline(): Promise<void> {
  if (classifier) return;
  
  if (initPromise) {
    await initPromise;
    return;
  }
  
  initPromise = (async () => {
    safeLog("info", "Loading local NLI model (first time may take a minute)...");
    const startTime = Date.now();
    
    try {
      // Dynamic import to avoid issues if package not installed
      const { pipeline } = await import("@xenova/transformers");
      
      // Use the configured model or default
      const modelName = config.nli.model?.includes("Xenova/") 
        ? config.nli.model 
        : DEFAULT_MODEL;
      
      // Create text-classification pipeline for NLI
      // NLI models are trained for sequence pair classification
      classifier = await pipeline("text-classification", modelName, {
        quantized: true,
      });
      
      const loadTime = Date.now() - startTime;
      safeLog("info", `Local NLI model loaded in ${loadTime}ms`, { model: modelName });
    } catch (error: any) {
      safeLog("error", "Failed to load local NLI model", { error: error.message });
      throw error;
    }
  })();
  
  await initPromise;
}

/**
 * Normalize text for NLI
 */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, 512);
}

/**
 * Local NLI Service - runs directly in Node.js
 */
export class LocalNliService implements NliService {
  private initialized = false;
  
  async classify(pair: NliPair): Promise<NliResult> {
    const results = await this.classifyBatch([pair]);
    return results[0];
  }
  
  async classifyBatch(pairs: NliPair[]): Promise<NliResult[]> {
    if (pairs.length === 0) return [];
    
    try {
      // Initialize pipeline if needed
      await initPipeline();
      this.initialized = true;
      
      const results: NliResult[] = [];
      
      for (const pair of pairs) {
        try {
          // NLI models expect input as "premise [SEP] hypothesis" or specific format
          // Most NLI models use: text (premise), text_pair (hypothesis)
          const premise = normalizeText(pair.premise);
          const hypothesis = normalizeText(pair.hypothesis);
          
          // Run classification - format depends on model
          // For MNLI models, we typically use: "{premise}</s></s>{hypothesis}" or similar
          const input = `${premise} [SEP] ${hypothesis}`;
          
          const output = await classifier(input, {
            topk: 3, // Get all three labels with scores
          });
          
          // Parse output - can be array of { label, score } objects
          if (Array.isArray(output) && output.length > 0) {
            // Find the highest scoring label
            const sorted = output.sort((a: any, b: any) => b.score - a.score);
            const top = sorted[0];
            
            const scores: Record<string, number> = {};
            for (const item of output) {
              const mappedLabel = LABEL_MAP[item.label] || item.label.toLowerCase();
              scores[mappedLabel] = item.score;
            }
            
            results.push({
              label: LABEL_MAP[top.label] || "neutral",
              confidence: top.score,
              scores,
            });
          } else {
            // Fallback
            results.push({
              label: "neutral",
              confidence: 0.33,
            });
          }
        } catch (pairError: any) {
          safeLog("warn", "NLI classification failed for pair", { error: pairError.message });
          results.push({
            label: "neutral",
            confidence: 0.33,
          });
        }
      }
      
      return results;
    } catch (error: any) {
      safeLog("error", "Local NLI batch classification failed", { error: error.message });
      // Return neutral for all pairs on catastrophic failure
      return pairs.map(() => ({
        label: "neutral" as NliLabel,
        confidence: 0.33,
      }));
    }
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      await import("@xenova/transformers");
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Check if local NLI is available
 */
export async function isLocalNliAvailable(): Promise<boolean> {
  try {
    await import("@xenova/transformers");
    return true;
  } catch {
    return false;
  }
}
