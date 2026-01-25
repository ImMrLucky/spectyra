import { OpenAIEmbeddings } from "./openaiEmbeddings.js";
import type { EmbeddingService } from "../optimizer/optimizer.js";

class EmbedderRegistry {
  private embedders: Map<string, EmbeddingService> = new Map();
  
  constructor() {
    // Initialize OpenAI embedder (MVP)
    try {
      this.register("openai", new OpenAIEmbeddingService());
    } catch (e) {
      console.warn("OpenAI embedder not available:", e);
    }
  }
  
  register(name: string, embedder: EmbeddingService) {
    this.embedders.set(name, embedder);
  }
  
  get(name: string): EmbeddingService | undefined {
    return this.embedders.get(name);
  }
  
  getDefault(): EmbeddingService {
    return this.get("openai") || this.embedders.values().next().value;
  }
}

class OpenAIEmbeddingService implements EmbeddingService {
  private client: OpenAIEmbeddings;
  
  constructor() {
    this.client = new OpenAIEmbeddings();
  }
  
  async embed(texts: string[]): Promise<number[][]> {
    return this.client.embedBatch(texts);
  }
}

export const embedderRegistry = new EmbedderRegistry();

export function getEmbedder(name: string = "openai"): EmbeddingService {
  const embedder = embedderRegistry.get(name);
  if (!embedder) {
    throw new Error(`Embedder ${name} not available`);
  }
  return embedder;
}
