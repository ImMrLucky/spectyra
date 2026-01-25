import OpenAI from "openai";
import { config } from "../../config.js";
import type { EmbeddingProvider } from "./types.js";

export class OpenAIEmbeddings implements EmbeddingProvider {
  private client: OpenAI;
  private model: string;
  
  constructor() {
    this.client = new OpenAI({
      apiKey: config.providers.openai.apiKey,
    });
    this.model = config.embeddings.openaiModel;
  }
  
  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    
    return response.data[0].embedding;
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    
    return response.data.map(d => d.embedding);
  }
}
