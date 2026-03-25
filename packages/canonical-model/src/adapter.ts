/**
 * Adapter interface.
 *
 * Every external integration (provider SDK, local companion, agent harness)
 * must implement this interface to translate between its native format and
 * the canonical model.
 *
 * Adapters may normalize formats. Adapters must NOT apply optimization
 * transforms, make policy decisions, or embed vendor-specific heuristics.
 */

import type { CanonicalRequest, CanonicalExecutionMetadata } from "./request.js";
import type { CanonicalResponse } from "./response.js";

export type AdapterCategory = "provider" | "tool" | "companion" | "agent_harness";

export interface AdapterContext {
  /** Override run mode for this specific request. */
  runModeOverride?: "off" | "observe" | "on";
  /** Additional metadata the caller wants to attach. */
  extra?: Record<string, unknown>;
}

export interface UsageEstimate {
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
}

/**
 * Every integration adapter implements this interface.
 *
 * @typeParam TExternalRequest  The vendor-specific request type.
 * @typeParam TExternalResponse The vendor-specific response type.
 */
export interface SpectyraAdapter<
  TExternalRequest = unknown,
  TExternalResponse = unknown,
> {
  /** Unique identifier for this adapter (e.g. "openai", "anthropic", "local-companion"). */
  id: string;

  /** Which kind of integration this adapter serves. */
  category: AdapterCategory;

  /** Returns true if this adapter can handle the given input. */
  canHandle(input: unknown): boolean;

  /** Translate external request → canonical request. */
  toCanonicalRequest(
    input: TExternalRequest,
    context?: AdapterContext,
  ): CanonicalRequest;

  /** Translate canonical response → external response. */
  fromCanonicalResponse(
    canonical: CanonicalResponse,
    originalInput: TExternalRequest,
    context?: AdapterContext,
  ): TExternalResponse;

  /** Extract execution metadata from the external request (optional). */
  extractExecutionMetadata?(
    input: TExternalRequest,
  ): Partial<CanonicalExecutionMetadata>;

  /** Estimate token usage from the external request before calling the provider (optional). */
  estimateExternalUsage?(input: TExternalRequest): Partial<UsageEstimate>;
}
