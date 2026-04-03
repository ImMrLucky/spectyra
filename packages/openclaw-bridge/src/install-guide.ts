import type { OpenClawInstallGuide } from "./types.js";

export const OPENCLAW_INSTALL_GUIDE: OpenClawInstallGuide = {
  title: "OpenClaw + Spectyra (local-first)",
  privacySummary:
    "OpenClaw sends requests to Spectyra running locally on your machine. Spectyra optimizes them locally, " +
    "then sends them directly to your AI provider using your own API keys. Prompt content does not pass through Spectyra cloud servers.",
  modeExplanations: {
    on: "ON — full optimization pipeline applied before the provider call (when licensed).",
    observe:
      "OBSERVE — runs analysis and can report projected savings without changing the execution path as in ON mode (see Desktop settings).",
    off: "OFF — baseline pass-through; no optimization transforms applied.",
  },
  flowSummary: "OpenClaw → Spectyra Local Companion (localhost) → your provider (OpenAI, Anthropic, Groq, …).",
};
