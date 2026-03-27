import type { SpectyraEvent } from "./types.js";

/**
 * Strip fields that must never leave the customer environment by default.
 */
export function redactEventForCloudPreview(event: SpectyraEvent): Record<string, unknown> {
  const base = {
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    sessionId: event.sessionId,
    runId: event.runId,
    stepId: event.stepId,
    source: event.source,
    appName: event.appName,
    workflowType: event.workflowType,
    provider: event.provider,
    model: event.model,
    security: event.security,
  };

  if (event.security.containsPromptContent || event.security.containsResponseContent) {
    return { ...base, payload: { _redacted: true } };
  }

  return { ...base, payload: event.payload };
}
