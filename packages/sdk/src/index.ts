/**
 * Spectyra SDK
 * 
 * SDK-first agent runtime control: routing, budgets, tool gating, telemetry
 * 
 * @example
 * ```ts
 * // Local mode (default, no API required)
 * import { createSpectyra } from '@spectyra/sdk';
 * 
 * const spectyra = createSpectyra({ mode: "local" });
 * 
 * // Use with Claude Agent SDK
 * const options = spectyra.agentOptions(ctx, prompt);
 * const result = await agent.query({ prompt, options });
 * ```
 * 
 * @example
 * ```ts
 * // API mode (enterprise control plane)
 * const spectyra = createSpectyra({
 *   mode: "api",
 *   endpoint: "https://spectyra.up.railway.app/v1",
 *   apiKey: process.env.SPECTYRA_API_KEY,
 * });
 * 
 * const response = await spectyra.agentOptionsRemote(ctx, promptMeta);
 * ```
 */

// New SDK-first API
export { createSpectyra } from "./createSpectyra.js";
export type {
  SpectyraConfig,
  SpectyraMode,
  SpectyraCtx,
  PromptMeta,
  ClaudeAgentOptions,
  AgentDecision,
  AgentOptionsRequest,
  AgentOptionsResponse,
  AgentEventRequest,
  AgentEventResponse,
} from "./types.js";

// Legacy API (deprecated but still supported)
export { SpectyraClient } from "./legacy/SpectyraClient.js";
export type {
  SpectyraClientConfig,
  ChatOptions,
  ChatResponse,
  ChatMessage,
  Usage,
  Path,
  Mode,
} from "./types.js";
