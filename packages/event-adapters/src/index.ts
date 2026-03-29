export * from "./source-labels.js";
export * from "./sdk/adapter.js";
export * from "./local-companion/adapter.js";
export * from "./openclaw-jsonl/adapter.js";
export * from "./generic-jsonl/adapter.js";
export * from "./claude-hooks/adapter.js";
export * from "./claude-jsonl/adapter.js";
export * from "./openai-tracing/adapter.js";
import { sdkEventAdapter } from "./sdk/adapter.js";
import { localCompanionEventAdapter } from "./local-companion/adapter.js";
import { openclawJsonlAdapter } from "./openclaw-jsonl/adapter.js";
import { genericJsonlAdapter } from "./generic-jsonl/adapter.js";
import { claudeHooksAdapter } from "./claude-hooks/adapter.js";
import { claudeJsonlAdapter } from "./claude-jsonl/adapter.js";
import { openAiTracingAdapter } from "./openai-tracing/adapter.js";

/** Default registration order (first match wins). */
export const defaultEventAdapters = [
  sdkEventAdapter,
  localCompanionEventAdapter,
  openclawJsonlAdapter,
  claudeJsonlAdapter,
  claudeHooksAdapter,
  openAiTracingAdapter,
  genericJsonlAdapter,
];

export { newId, defaultSecurity } from "./helpers.js";
