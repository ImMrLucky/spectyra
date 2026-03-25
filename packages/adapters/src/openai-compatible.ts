/**
 * OpenAI-compatible adapter.
 *
 * For providers that implement the OpenAI chat completions API shape
 * (Groq, local models, etc.). Reuses the OpenAI adapter logic with
 * a different vendor/apiStyle tag.
 */

import type {
  SpectyraAdapter,
  AdapterContext,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalExecutionMetadata,
  UsageEstimate,
} from "@spectyra/canonical-model";
import { OpenAIAdapter, type OpenAIChatRequest, type OpenAIChatResponse } from "./openai.js";

export class OpenAICompatibleAdapter implements SpectyraAdapter<OpenAIChatRequest, OpenAIChatResponse> {
  id: string;
  category = "provider" as const;
  private vendorName: string;
  private inner = new OpenAIAdapter();

  constructor(vendorName: string) {
    this.id = `openai-compatible-${vendorName}`;
    this.vendorName = vendorName;
  }

  canHandle(input: unknown): boolean {
    return this.inner.canHandle(input);
  }

  toCanonicalRequest(input: OpenAIChatRequest, ctx?: AdapterContext): CanonicalRequest {
    const canonical = this.inner.toCanonicalRequest(input, ctx);
    if (canonical.provider) {
      canonical.provider.vendor = this.vendorName;
      canonical.provider.apiStyle = "openai_compatible";
    }
    return canonical;
  }

  fromCanonicalResponse(canonical: CanonicalResponse, originalInput: OpenAIChatRequest): OpenAIChatResponse {
    return this.inner.fromCanonicalResponse(canonical, originalInput);
  }

  extractExecutionMetadata(input: OpenAIChatRequest): Partial<CanonicalExecutionMetadata> {
    return this.inner.extractExecutionMetadata!(input);
  }

  estimateExternalUsage(input: OpenAIChatRequest): Partial<UsageEstimate> {
    return this.inner.estimateExternalUsage!(input);
  }
}

/** Pre-built Groq adapter. */
export class GroqAdapter extends OpenAICompatibleAdapter {
  constructor() { super("groq"); this.id = "groq"; }
}
