/**
 * Spectyra SDK
 * 
 * Real-time LLM optimization middleware that reduces token usage and cost
 * by preventing semantic recomputation.
 * 
 * @example
 * ```ts
 * import { SpectyraClient } from '@spectyra/sdk';
 * 
 * const client = new SpectyraClient({
 *   apiUrl: 'https://spectyra.up.railway.app/v1',
 *   spectyraKey: process.env.SPECTYRA_API_KEY,
 *   provider: 'openai',
 *   providerKey: process.env.OPENAI_API_KEY, // BYOK
 * });
 * 
 * const response = await client.chat({
 *   model: 'gpt-4o-mini',
 *   messages: [
 *     { role: 'user', content: 'Explain quantum computing' }
 *   ],
 *   path: 'talk',
 *   optimization_level: 3,
 * });
 * 
 * console.log(`Saved ${response.savings?.pct_saved}% tokens`);
 * ```
 */

export { SpectyraClient } from "./client.js";
export type {
  SpectyraClientConfig,
  ChatOptions,
  ChatResponse,
  ChatMessage,
  Usage,
  Path,
  Mode,
} from "./types.js";
