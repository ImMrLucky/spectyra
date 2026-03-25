/**
 * Adapter registry.
 *
 * Holds all registered adapters and resolves the best match for a given input.
 * Falls back to the generic adapter if nothing specific matches.
 */

import type { SpectyraAdapter } from "@spectyra/canonical-model";
import { OpenAIAdapter } from "./openai.js";
import { AnthropicAdapter } from "./anthropic.js";
import { GroqAdapter } from "./openai-compatible.js";
import { LocalCompanionAdapter } from "./local-companion.js";
import { AgentHarnessAdapter } from "./agent-harness.js";
import { GenericAdapter } from "./generic.js";

const builtInAdapters: SpectyraAdapter[] = [
  new OpenAIAdapter(),
  new AnthropicAdapter(),
  new GroqAdapter(),
  new LocalCompanionAdapter(),
  new AgentHarnessAdapter(),
];

const fallback = new GenericAdapter();

const customAdapters: SpectyraAdapter[] = [];

export function registerAdapter(adapter: SpectyraAdapter): void {
  customAdapters.push(adapter);
}

/**
 * Find the best adapter for a given input.
 * Checks custom adapters first (LIFO), then built-ins, then generic fallback.
 */
export function resolveAdapter(input: unknown): SpectyraAdapter {
  for (let i = customAdapters.length - 1; i >= 0; i--) {
    if (customAdapters[i].canHandle(input)) return customAdapters[i];
  }
  for (const adapter of builtInAdapters) {
    if (adapter.canHandle(input)) return adapter;
  }
  return fallback;
}

export function getAdapterById(id: string): SpectyraAdapter | undefined {
  return customAdapters.find(a => a.id === id)
    ?? builtInAdapters.find(a => a.id === id)
    ?? (id === "generic" ? fallback : undefined);
}

export function listAdapters(): Array<{ id: string; category: string }> {
  return [
    ...customAdapters.map(a => ({ id: a.id, category: a.category })),
    ...builtInAdapters.map(a => ({ id: a.id, category: a.category })),
    { id: fallback.id, category: fallback.category },
  ];
}
