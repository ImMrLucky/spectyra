/**
 * UI and routing labels for event sources — maps to SpectyraAnalyticsIntegration where applicable.
 */

export const EVENT_SOURCE_LABELS: Record<string, { label: string; integrationHint: string }> = {
  "sdk-wrapper": { label: "SDK App", integrationHint: "sdk-wrapper" },
  "local-companion": { label: "Local Companion", integrationHint: "local-companion" },
  "openclaw-jsonl": { label: "OpenClaw", integrationHint: "openclaw-jsonl" },
  "claude-hooks": { label: "Claude Runtime", integrationHint: "claude-hooks" },
  "claude-jsonl": { label: "Claude Runtime", integrationHint: "claude-jsonl" },
  "openai-tracing": { label: "OpenAI Agents", integrationHint: "openai-tracing" },
  "generic-jsonl": { label: "Generic attach", integrationHint: "generic-jsonl" },
  unknown: { label: "Unknown source", integrationHint: "unknown" },
};

export function labelForIntegration(integration: string | undefined): string {
  if (!integration) return EVENT_SOURCE_LABELS.unknown.label;
  return EVENT_SOURCE_LABELS[integration]?.label ?? integration;
}
