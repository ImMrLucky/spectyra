/**
 * Integration metadata model.
 *
 * Used by the Website App integrations page and the Desktop App
 * to describe each integration path with consistent security / data-flow info.
 */

import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  InferencePath,
  IntegrationType,
} from "./modes.js";

/**
 * Structured metadata for a single integration card.
 */
export interface IntegrationCardMeta {
  id: string;
  name: string;
  category: IntegrationType;

  recommended: boolean;
  requiresCodeChanges: boolean;
  runsWhere: string;
  promptLeavesEnvironmentByDefault: boolean;
  providerCallPath: InferencePath;
  telemetryDefault: TelemetryMode;
  promptSnapshotDefault: PromptSnapshotMode;
  recommendedFirstMode: SpectyraRunMode;

  securityNotes: string[];
  setupSteps: string[];
  verificationSteps: string[];

  quickstart?: {
    language?: string;
    code?: string;
    command?: string;
  };
}

/**
 * Pre-built integration card metadata for the four primary integrations.
 */
export const INTEGRATION_CARDS: readonly IntegrationCardMeta[] = [
  {
    id: "local-companion",
    name: "Desktop App / Local Companion",
    category: "local-companion",
    recommended: true,
    requiresCodeChanges: false,
    runsWhere: "Your machine (localhost)",
    promptLeavesEnvironmentByDefault: false,
    providerCallPath: "direct_provider",
    telemetryDefault: "local",
    promptSnapshotDefault: "local_only",
    recommendedFirstMode: "observe",
    securityNotes: [
      "Prompts and responses stay on your machine",
      "Provider calls go directly from your machine to the provider",
      "No Spectyra cloud relay for inference",
      "Provider key never leaves your machine",
    ],
    setupSteps: [
      "Download and install the Spectyra Desktop App",
      "Enter your provider API key (stored locally, never uploaded)",
      "Choose run mode (observe recommended to start)",
      "Point your LLM tool (e.g. OpenClaw) to http://127.0.0.1:4111",
      "Run a test and verify savings",
    ],
    verificationSteps: [
      "Open the Desktop App savings dashboard",
      "Confirm inference path shows 'Direct to provider'",
      "Confirm telemetry shows 'Local only'",
      "Run a prompt and check the before/after comparison",
    ],
  },
  {
    id: "sdk-wrapper",
    name: "SDK Wrapper",
    category: "sdk-wrapper",
    recommended: true,
    requiresCodeChanges: true,
    runsWhere: "Your application process",
    promptLeavesEnvironmentByDefault: false,
    providerCallPath: "direct_provider",
    telemetryDefault: "local",
    promptSnapshotDefault: "local_only",
    recommendedFirstMode: "observe",
    securityNotes: [
      "Optimization runs in your process — no external calls for inference",
      "Your provider SDK client makes the actual LLM call",
      "Provider key stays in your environment",
      "Reports are emitted locally; cloud sync is opt-in",
    ],
    setupSteps: [
      "Install @spectyra/sdk or @spectyra/agents",
      "Wrap your provider call with spectyra.complete()",
      "Set runMode to 'observe' to start",
      "Review the SavingsReport returned with each call",
    ],
    verificationSteps: [
      "Check the SavingsReport.inferencePath is 'direct_provider'",
      "Check the SavingsReport.providerBillingOwner is 'customer'",
      "Confirm no network calls to Spectyra servers during inference",
    ],
    quickstart: {
      language: "typescript",
      code: [
        "import { createSpectyra } from '@spectyra/sdk';",
        "",
        "const spectyra = createSpectyra({",
        "  runMode: 'observe',",
        "  licenseKey: process.env.SPECTYRA_LICENSE_KEY,",
        "});",
        "",
        "const { providerResult, report } = await spectyra.complete({",
        "  provider: 'openai',",
        "  client: openaiClient,",
        "  model: 'gpt-4.1-mini',",
        "  messages,",
        "});",
      ].join("\n"),
    },
  },
  {
    id: "observe-preview",
    name: "Observe / Preview",
    category: "observe-preview",
    recommended: false,
    requiresCodeChanges: false,
    runsWhere: "Spectyra website (dry-run)",
    promptLeavesEnvironmentByDefault: false,
    providerCallPath: "direct_provider",
    telemetryDefault: "local",
    promptSnapshotDefault: "local_only",
    recommendedFirstMode: "observe",
    securityNotes: [
      "No provider call is made",
      "Savings are projected, not realized",
      "No provider key required",
    ],
    setupSteps: [
      "Open Spectyra Studio or Observe page",
      "Paste or select a sample prompt",
      "View projected savings",
    ],
    verificationSteps: [
      "Confirm 'No provider call made' label is visible",
      "Review before/after prompt comparison",
    ],
  },
  {
    id: "legacy-remote-gateway",
    name: "Legacy Remote Gateway",
    category: "legacy-remote-gateway",
    recommended: false,
    requiresCodeChanges: true,
    runsWhere: "Spectyra cloud",
    promptLeavesEnvironmentByDefault: true,
    providerCallPath: "legacy_remote_gateway",
    telemetryDefault: "cloud_redacted",
    promptSnapshotDefault: "cloud_opt_in",
    recommendedFirstMode: "on",
    securityNotes: [
      "DEPRECATED — prompts are routed through Spectyra servers",
      "Use SDK Wrapper or Local Companion instead",
      "Provider key is sent to Spectyra API (not stored long-term)",
    ],
    setupSteps: [
      "Point your application to the Spectyra /v1/chat endpoint",
      "Set X-SPECTYRA-API-KEY and X-PROVIDER-KEY headers",
    ],
    verificationSteps: [
      "Confirm the response includes optimization metadata",
    ],
  },
] as const;
