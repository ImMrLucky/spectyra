import type { CompanionConnectionState } from "../companion/companion-types.js";

export interface StatusPanelDescriptor {
  kind: "spectyra.status_panel";
  connected: boolean;
  optimizationEnabled: boolean;
  securityWarningsEnabled: boolean;
  companionBase: string;
}

export interface StatusMarkdownExtras {
  /** e.g. `⚡ Spectyra saved 42% · $0.18 estimated` from companion `/openclaw/v1/latest`. */
  latestSavingsLine?: string | null;
  /** Markdown block from flow aggregate. */
  flowSummaryMarkdown?: string | null;
}

export function buildStatusPanelDescriptor(input: {
  state: CompanionConnectionState;
  optimizationEnabled: boolean;
  securityWarningsEnabled: boolean;
  companionBase: string;
}): StatusPanelDescriptor {
  return {
    kind: "spectyra.status_panel",
    connected: input.state.reachable,
    optimizationEnabled: input.optimizationEnabled,
    securityWarningsEnabled: input.securityWarningsEnabled,
    companionBase: input.companionBase,
  };
}

export function formatSpectyraStatusMarkdown(desc: StatusPanelDescriptor, extras?: StatusMarkdownExtras): string {
  if (!desc.connected) {
    return [
      "## ⚡ Spectyra is installed",
      "",
      "Start Spectyra in your terminal:",
      "",
      "```bash",
      "npx @spectyra/local-companion start --open",
      "```",
      "",
      "Then run any OpenClaw prompt.",
      "**Savings will appear here automatically.**",
      "",
      `_Security notices are non-blocking (v1). Plugin: ${desc.securityWarningsEnabled ? "on" : "off"}._`,
    ].join("\n");
  }

  const parts: string[] = [];

  if (extras?.latestSavingsLine) {
    parts.push(
      "## ⚡ Spectyra",
      "",
      "**Latest OpenClaw savings:**",
      "",
      extras.latestSavingsLine,
      "",
    );
    if (extras.flowSummaryMarkdown) {
      parts.push(extras.flowSummaryMarkdown, "");
    }
    parts.push(
      `**Companion:** ${desc.companionBase}`,
      `**Optimization:** ${desc.optimizationEnabled ? "ON" : "OFF"}`,
      "",
      "_Savings values come only from your local Spectyra companion — nothing is fabricated._",
    );
    return parts.join("\n");
  }

  parts.push(
    "## ⚡ Spectyra Active",
    "",
    `**Optimization:** ${desc.optimizationEnabled ? "ON" : "OFF"}`,
    "**Waiting for your next OpenClaw run…**",
    "",
    "**Latest OpenClaw savings:** —",
    "",
    `_When a run completes, the companion publishes it to \`/openclaw/v1/latest\` — this panel updates automatically._`,
    "",
    `**Companion:** ${desc.companionBase}`,
  );
  return parts.join("\n");
}

/** @deprecated Use formatSpectyraStatusMarkdown */
export function formatStatusCommandText(desc: StatusPanelDescriptor): string {
  return formatSpectyraStatusMarkdown(desc);
}
