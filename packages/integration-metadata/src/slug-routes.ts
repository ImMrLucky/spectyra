/**
 * Map URL slug (integrations/:slug) to scenario card id and optional OpenClaw focus.
 */
export const INTEGRATION_SLUG_TO_CARD_ID: Record<string, string> = {
  sdk: "sdk-library",
  "local-companion": "desktop-companion",
  openclaw: "desktop-companion",
  "server-sidecar": "server-sidecar",
  events: "events-logs-traces",
  "claude-agent-sdk": "sdk-library",
  "openai-agents": "sdk-library",
};

/** Slugs that should scroll / emphasize the OpenClaw subsection */
export const OPENCLAW_FOCUS_SLUGS = new Set(["openclaw"]);
