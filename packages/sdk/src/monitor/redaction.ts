import type { SpectyraMonitorEvent } from "./monitorTypes.js";

const FORBIDDEN_KEYS = new Set([
  "authorization",
  "apikey",
  "api_key",
  "x-api-key",
  "openai_api_key",
  "anthropic_api_key",
  "prompt",
  "messages",
  "response",
  "content",
  "body",
  "rawbody",
  "input_text",
  "output_text",
]);

/**
 * Remove keys that must never appear in JSONL / buffers (defense in depth).
 * @public
 */
export function scrubMonitorEventForPersistence(ev: SpectyraMonitorEvent): SpectyraMonitorEvent {
  const raw = ev as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...raw };
  for (const k of Object.keys(out)) {
    if (FORBIDDEN_KEYS.has(k.toLowerCase())) {
      delete out[k];
    }
  }
  out.metadataOnly = true;
  return out as unknown as SpectyraMonitorEvent;
}
