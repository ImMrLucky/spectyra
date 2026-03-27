import type {
  IntegrationCardDefinition,
  IntegrationComparisonRow,
  IntegrationPageDefinition,
  IntegrationsPayload,
} from "./types.js";

export const TRUST_LABELS = [
  "Runs locally",
  "Direct provider billing",
  "Prompts stay local by default",
  "Works with Observe mode",
  "Real-time savings supported",
  "No code changes required",
  "Best for apps you control",
  "Best for OpenClaw and similar tools",
  "Best for server/VM agents",
  "Best for analytics-first integrations",
] as const;

/** Exact OpenClaw provider snippet — Local Companion default port */
export const OPENCLAW_CONFIG_JSON = `{
  "models": {
    "providers": {
      "spectyra": {
        "baseUrl": "http://127.0.0.1:4111/v1",
        "apiKey": "SPECTYRA_LOCAL",
        "api": "openai-completions",
        "models": [
          {
            "id": "smart",
            "name": "Spectyra Smart",
            "contextWindow": 128000,
            "maxTokens": 8192
          },
          {
            "id": "fast",
            "name": "Spectyra Fast",
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "spectyra/smart"
      }
    }
  }
}`;

const sdkSnippet = `import { createSpectyra, createOpenAIAdapter } from '@spectyra/sdk';
import OpenAI from 'openai';

const spectyra = createSpectyra({
  runMode: 'observe',
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { providerResult, report } = await spectyra.complete(
  {
    provider: 'openai',
    client: openai,
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: 'Hello' }],
  },
  createOpenAIAdapter(),
);

console.log(\`Saved \${report.estimatedSavingsPct.toFixed(1)}%\`);`;

export const INTEGRATION_SCENARIOS: IntegrationCardDefinition[] = [
  {
    id: "sdk-library",
    title: "SDK / Library Integration",
    scenario: "sdk_wrapper",
    recommendedFor: ["Best for apps you control"],
    requiresCodeChanges: true,
    requiresCustomEndpoint: false,
    runsWhere: "app_process",
    directProviderBilling: true,
    promptsStayLocalByDefault: true,
    realTimeSavingsSupported: true,
    observeModeSupported: true,
    onModeSupported: true,
    supportedToolsExamples: [
      "OpenAI / Anthropic / Groq apps",
      "Claude Agent SDK",
      "OpenAI Agents SDK",
      "Internal services",
    ],
    setupComplexity: "medium",
    heroSummary:
      "Add Spectyra where your app calls the LLM. Best optimization fidelity; your provider SDK still bills your account.",
    simpleHowItWorks: ["Your app", "Spectyra SDK", "Your provider"],
    setupSteps: [
      "Install @spectyra/sdk",
      "Wrap the call site where you invoke the model",
      "Choose Off, Observe, or On",
      "See savings locally in real time",
      "Optionally sign in to sync analytics summaries only",
    ],
    verificationSteps: [
      "Run one real workflow",
      "Open the savings panel / report",
      "Confirm before vs after tokens, savings %, direct provider billing",
      "Confirm prompts stay local by default",
    ],
    securityNotes: [
      "Telemetry defaults to local; prompt snapshots local-only by default",
      "No Spectyra cloud relay for inference",
      "Provider keys never sent to Spectyra",
    ],
    troubleshootingTips: [
      "Start in Observe before On",
      "Verify SavingsReport shows direct_provider inference path",
    ],
    copyableConfigSnippets: [{ label: "Minimal TypeScript", language: "typescript", content: sdkSnippet }],
  },
  {
    id: "desktop-companion",
    title: "Desktop App / Local Companion",
    scenario: "local_companion",
    recommendedFor: ["Best for OpenClaw and similar tools"],
    requiresCodeChanges: false,
    requiresCustomEndpoint: true,
    runsWhere: "desktop_localhost",
    directProviderBilling: true,
    promptsStayLocalByDefault: true,
    realTimeSavingsSupported: true,
    observeModeSupported: true,
    onModeSupported: true,
    supportedToolsExamples: ["OpenClaw", "OpenClaw-like agents", "Tools with local OpenAI-compatible URL"],
    setupComplexity: "easy",
    heroSummary:
      "No code in your tool required. Spectyra Desktop runs a local OpenAI-compatible endpoint; traffic goes to your real provider with your key.",
    simpleHowItWorks: ["Tool", "Spectyra Local Companion on localhost", "Your provider"],
    setupSteps: [
      "Install Spectyra Desktop",
      "Choose provider and paste your provider API key",
      "Start Local Companion",
      "Point your tool to http://127.0.0.1:4111/v1",
      "Use models spectyra/smart or spectyra/fast (local routing profiles)",
      "Run a test workflow and open savings in Desktop",
    ],
    verificationSteps: [
      "Confirm the tool reaches localhost",
      "Run a prompt; confirm savings appear locally",
      "Confirm upstream billing is still on your provider account",
    ],
    securityNotes: [
      "Prompts and responses stay on your machine by default",
      "Optional analytics sync sends summaries only — not raw prompts by default",
    ],
    troubleshootingTips: [
      "If connection fails, confirm Companion is running and port 4111 is not blocked",
      "spectyra/smart maps to the model you selected in Desktop — not a separate vendor",
    ],
    copyableConfigSnippets: [
      { label: "OpenClaw models.providers", language: "json", content: OPENCLAW_CONFIG_JSON },
    ],
  },
  {
    id: "server-sidecar",
    title: "Server / VM Sidecar",
    scenario: "server_sidecar",
    recommendedFor: ["Best for server/VM agents"],
    requiresCodeChanges: false,
    requiresCustomEndpoint: true,
    runsWhere: "server_vm",
    directProviderBilling: true,
    promptsStayLocalByDefault: true,
    realTimeSavingsSupported: true,
    observeModeSupported: true,
    onModeSupported: true,
    supportedToolsExamples: [
      "Claude Agent SDK on a VM",
      "OpenAI Agents on Kubernetes",
      "Background workers",
    ],
    setupComplexity: "medium",
    heroSummary:
      "Run Spectyra beside your agent in the same environment. Data stays in your VPC; provider billing stays on your account.",
    simpleHowItWorks: ["Server agent", "Spectyra sidecar / SDK", "Your provider"],
    setupSteps: [
      "Deploy Spectyra next to the agent (process or localhost service)",
      "Use the SDK in the app or point HTTP to the local sidecar",
      "Keep provider keys in env / secrets in your environment",
      "Use Observe or On as appropriate",
      "Optionally sign in for analytics summary sync",
    ],
    verificationSteps: [
      "Run an agent workflow end-to-end",
      "Confirm savings in local dashboard or reports",
      "Confirm provider invoices still go to your org",
    ],
    securityNotes: [
      "Same defaults as SDK: local telemetry, local prompt snapshots by default",
      "No requirement to route inference through Spectyra cloud",
    ],
    troubleshootingTips: [
      "Prefer SDK in-process for lowest latency; sidecar HTTP if you cannot change the agent binary",
    ],
  },
  {
    id: "events-logs-traces",
    title: "Observe / Events / Logs / Traces",
    scenario: "event_ingestion",
    recommendedFor: ["Best for analytics-first integrations"],
    requiresCodeChanges: false,
    requiresCustomEndpoint: false,
    runsWhere: "analytics_only",
    directProviderBilling: true,
    promptsStayLocalByDefault: true,
    realTimeSavingsSupported: false,
    observeModeSupported: true,
    onModeSupported: false,
    supportedToolsExamples: [
      "JSONL exports",
      "Claude hooks / structured events",
      "Tracing exports",
    ],
    setupComplexity: "advanced",
    heroSummary:
      "When Spectyra is not in the live request path, ingest official structured signals, normalize to one event model, and compute analytics locally.",
    simpleHowItWorks: ["Tool logs / events / traces", "Spectyra adapters", "Local analytics"],
    setupSteps: [
      "Choose the adapter for your tool",
      "Point Spectyra at the local file or stream",
      "Import or run a session",
      "Review projected savings and workflow inefficiencies locally",
    ],
    verificationSteps: [
      "Sessions appear in the local UI",
      "Adapter health is OK",
      "Projected token / workflow savings visible",
    ],
    securityNotes: [
      "Raw log content stays local by default",
      "Only normalized analytics summaries sync if you enable cloud sync",
    ],
    troubleshootingTips: [
      "This path is best for Observe and backfill — not a substitute for live On mode in the SDK",
    ],
  },
];

export const COMPARISON_ROWS: IntegrationComparisonRow[] = [
  {
    id: "sdk-library",
    codeChanges: true,
    runsLocally: true,
    directProviderBilling: true,
    realTimeSavings: true,
    goodForOpenClaw: false,
    goodForServerAgents: true,
    goodForSdkApps: true,
  },
  {
    id: "desktop-companion",
    codeChanges: false,
    runsLocally: true,
    directProviderBilling: true,
    realTimeSavings: true,
    goodForOpenClaw: true,
    goodForServerAgents: false,
    goodForSdkApps: false,
  },
  {
    id: "server-sidecar",
    codeChanges: false,
    runsLocally: false,
    directProviderBilling: true,
    realTimeSavings: true,
    goodForOpenClaw: false,
    goodForServerAgents: true,
    goodForSdkApps: true,
  },
  {
    id: "events-logs-traces",
    codeChanges: false,
    runsLocally: true,
    directProviderBilling: true,
    realTimeSavings: false,
    goodForOpenClaw: false,
    goodForServerAgents: true,
    goodForSdkApps: false,
  },
];

function pageBase(
  partial: Omit<IntegrationPageDefinition, "whatYouWillSee" | "trustLabels"> & {
    whatYouWillSee?: string[];
    trustLabels?: string[];
  },
): IntegrationPageDefinition {
  return {
    trustLabels: [...TRUST_LABELS.slice(0, 6)],
    whatYouWillSee: [
      "Before cost / After cost (when applicable)",
      "You saved %",
      "Token reduction",
      "Workflow / repeated-context signals (where enabled)",
      "Direct provider — prompts local — analytics local or synced summaries only",
    ],
    ...partial,
  };
}

export const INTEGRATION_PAGES: IntegrationPageDefinition[] = [
  pageBase({
    slug: "sdk",
    scenario: "sdk_wrapper",
    title: "SDK / Library",
    navLabel: "SDK",
    heroSummary: INTEGRATION_SCENARIOS[0].heroSummary,
    flowLine: "Your app → Spectyra SDK → Your provider",
    whatThisIs: [
      "For codebases where you can wrap the LLM call site.",
      "Best fidelity for On mode and before/after savings.",
    ],
    howItWorks: INTEGRATION_SCENARIOS[0].simpleHowItWorks,
    bestFor: INTEGRATION_SCENARIOS[0].supportedToolsExamples,
    securitySection: INTEGRATION_SCENARIOS[0].securityNotes,
    setupSteps: INTEGRATION_SCENARIOS[0].setupSteps,
    verificationSteps: INTEGRATION_SCENARIOS[0].verificationSteps,
    commonMistakes: INTEGRATION_SCENARIOS[0].troubleshootingTips,
    ctas: [
      { label: "Use this integration", route: "/download" },
      { label: "View SDK docs", href: "https://github.com/spectyra/spectyra", external: true },
    ],
    copyableConfigSnippets: INTEGRATION_SCENARIOS[0].copyableConfigSnippets,
  }),
  pageBase({
    slug: "local-companion",
    scenario: "local_companion",
    title: "Desktop App / Local Companion",
    navLabel: "Local Companion",
    heroSummary: INTEGRATION_SCENARIOS[1].heroSummary,
    flowLine: "Tool → Spectyra Local Companion on localhost → Your provider",
    whatThisIs: [
      "Spectyra Desktop runs a local OpenAI-compatible /v1 API.",
      "Your tools point at localhost; Spectyra forwards to the real provider with your key.",
    ],
    howItWorks: INTEGRATION_SCENARIOS[1].simpleHowItWorks,
    bestFor: INTEGRATION_SCENARIOS[1].supportedToolsExamples,
    securitySection: INTEGRATION_SCENARIOS[1].securityNotes,
    setupSteps: INTEGRATION_SCENARIOS[1].setupSteps,
    verificationSteps: INTEGRATION_SCENARIOS[1].verificationSteps,
    commonMistakes: INTEGRATION_SCENARIOS[1].troubleshootingTips,
    ctas: [
      { label: "Download Desktop App", route: "/download" },
      { label: "View OpenClaw setup", route: "/integrations/openclaw" },
    ],
    copyableConfigSnippets: INTEGRATION_SCENARIOS[1].copyableConfigSnippets,
  }),
  pageBase({
    slug: "openclaw",
    scenario: "local_companion",
    title: "OpenClaw",
    navLabel: "OpenClaw",
    heroSummary:
      "Spectyra works with OpenClaw by running as a local custom provider on localhost. No traffic interception — you configure OpenClaw to call Spectyra explicitly.",
    flowLine: "OpenClaw → Spectyra Local Companion on localhost → Your chosen provider",
    whatThisIs: [
      "Add Spectyra under models.providers with baseUrl http://127.0.0.1:4111/v1",
      "Use model refs spectyra/smart or spectyra/fast — local routing profiles mapped to your real model in Desktop.",
    ],
    howItWorks: ["OpenClaw", "Local Companion", "your provider API"],
    bestFor: ["OpenClaw", "Tools that support custom OpenAI-compatible providers"],
    securitySection: [
      "Prompts stay local by default",
      "Direct provider billing on your account",
      "No hidden request hijacking",
    ],
    setupSteps: [
      "Start Spectyra Desktop",
      "Confirm Local Companion is running (status in app)",
      "Paste provider JSON (see snippet) into OpenClaw config",
      "Run: openclaw models list — confirm spectyra/smart appears",
      "Run a test prompt and confirm savings in Spectyra Desktop",
    ],
    verificationSteps: [
      "openclaw models list shows spectyra/smart (and spectyra/fast)",
      "A test run completes through localhost",
      "Savings appear in Desktop in real time",
    ],
    commonMistakes: [
      "Wrong base URL or port",
      "Expecting spectyra/smart to be a cloud model — it is a local alias",
    ],
    ctas: [
      { label: "Download Desktop App", route: "/download" },
      { label: "Local Companion overview", route: "/integrations/local-companion" },
    ],
    copyableConfigSnippets: [
      { label: "OpenClaw models.providers", language: "json", content: OPENCLAW_CONFIG_JSON },
    ],
  }),
  pageBase({
    slug: "server-sidecar",
    scenario: "server_sidecar",
    title: "Server / VM Sidecar",
    navLabel: "Server Sidecar",
    heroSummary: INTEGRATION_SCENARIOS[2].heroSummary,
    flowLine: "Server agent → Spectyra sidecar / SDK → Your provider",
    whatThisIs: [
      "Run Spectyra in the same VM, container, or network namespace as the agent.",
    ],
    howItWorks: INTEGRATION_SCENARIOS[2].simpleHowItWorks,
    bestFor: INTEGRATION_SCENARIOS[2].supportedToolsExamples,
    securitySection: INTEGRATION_SCENARIOS[2].securityNotes,
    setupSteps: INTEGRATION_SCENARIOS[2].setupSteps,
    verificationSteps: INTEGRATION_SCENARIOS[2].verificationSteps,
    commonMistakes: INTEGRATION_SCENARIOS[2].troubleshootingTips,
    ctas: [{ label: "SDK integration", route: "/integrations/sdk" }],
  }),
  pageBase({
    slug: "events",
    scenario: "event_ingestion",
    title: "Events / Logs / Traces",
    navLabel: "Events",
    heroSummary: INTEGRATION_SCENARIOS[3].heroSummary,
    flowLine: "Structured local signals → Spectyra adapters → Local analytics",
    whatThisIs: [
      "Supported types: local JSONL, structured hooks, tracing exports (per adapter).",
      "Raw content stays local; only normalized summaries sync if enabled.",
    ],
    howItWorks: INTEGRATION_SCENARIOS[3].simpleHowItWorks,
    bestFor: INTEGRATION_SCENARIOS[3].supportedToolsExamples,
    securitySection: INTEGRATION_SCENARIOS[3].securityNotes,
    setupSteps: INTEGRATION_SCENARIOS[3].setupSteps,
    verificationSteps: INTEGRATION_SCENARIOS[3].verificationSteps,
    commonMistakes: INTEGRATION_SCENARIOS[3].troubleshootingTips,
    ctas: [{ label: "Observe", route: "/observe" }],
  }),
  pageBase({
    slug: "claude-agent-sdk",
    scenario: "sdk_wrapper",
    title: "Claude Agent SDK & Claude-style runtimes",
    navLabel: "Claude Agent SDK",
    heroSummary:
      "Spectyra supports Claude-style integrations via SDK (best fidelity) or server/VM sidecar — not via hidden interception.",
    flowLine: "Path A: App → SDK → provider | Path B: Agent → localhost sidecar → provider",
    whatThisIs: [
      "Path A — SDK: import Spectyra and wrap calls inside your runtime.",
      "Path B — Sidecar: run Spectyra beside the agent on the same host and call localhost.",
    ],
    howItWorks: ["SDK or sidecar", "same security defaults", "your provider keys in your env"],
    bestFor: ["Claude Agent SDK on a VM", "Anthropic workloads you control"],
    securitySection: [
      "We do not claim universal support for every closed app.",
      "Supported paths: SDK, sidecar, or supported structured local signals.",
    ],
    setupSteps: [
      "Choose SDK or sidecar",
      "Keep provider keys in your environment",
      "Use Observe first if unsure",
      "Verify savings and session analytics locally",
    ],
    verificationSteps: [
      "Run a session",
      "Confirm live savings locally",
      "Confirm provider billing remains on your account",
    ],
    commonMistakes: ["Assuming Spectyra can intercept closed binaries — it cannot"],
    ctas: [
      { label: "SDK setup", route: "/integrations/sdk" },
      { label: "Server sidecar", route: "/integrations/server-sidecar" },
    ],
  }),
  pageBase({
    slug: "openai-agents",
    scenario: "sdk_wrapper",
    title: "OpenAI Agents & tracing",
    navLabel: "OpenAI Agents",
    heroSummary:
      "Best path for live optimization is the SDK wrapper around your OpenAI calls. Tracing can feed structured analytics for Observe or post-run review.",
    flowLine: "Agents SDK → Spectyra SDK → OpenAI | Traces → adapters → local analytics",
    whatThisIs: [
      "Live On mode: wrap call sites with Spectyra SDK.",
      "Tracing: use official structured exports as inputs for analytics adapters where available.",
    ],
    howItWorks: ["Your code owns the provider client", "Spectyra computes savings around the call"],
    bestFor: ["OpenAI Agents SDK", "Traced workflows"],
    securitySection: [
      "Direct provider billing",
      "Prompts stay local by default",
      "Tracing exports handled locally unless you opt in",
    ],
    setupSteps: [
      "Install SDK and wrap provider calls",
      "Start with Observe or On per workflow",
      "Optionally connect tracing exports to adapters for dashboards",
    ],
    verificationSteps: [
      "Run a traced workflow",
      "Confirm before/after token metrics in On mode",
      "Confirm projected savings in Observe",
    ],
    commonMistakes: ["Confusing trace analytics with live On optimization — both are valid, different paths"],
    ctas: [
      { label: "SDK integration", route: "/integrations/sdk" },
      { label: "Events & traces", route: "/integrations/events" },
    ],
  }),
];

export const INTEGRATION_PAGES_BY_SLUG: Record<string, IntegrationPageDefinition> =
  Object.fromEntries(INTEGRATION_PAGES.map((p) => [p.slug, p]));

/** Map scenario card id → /integrations/:slug */
export const SCENARIO_CARD_DETAIL_SLUG: Record<string, string> = {
  "sdk-library": "sdk",
  "desktop-companion": "local-companion",
  "server-sidecar": "server-sidecar",
  "events-logs-traces": "events",
};

export function getIntegrationsPayload(): IntegrationsPayload {
  return {
    version: "1",
    heroTitle: "Use Spectyra with your AI workflow",
    heroSubtitle:
      "Choose the integration that matches how your app or tool runs. Spectyra keeps prompts local by default, uses your provider keys, and shows savings in real time.",
    trustLabels: TRUST_LABELS,
    comparisonRows: COMPARISON_ROWS,
    scenarios: INTEGRATION_SCENARIOS,
    pages: INTEGRATION_PAGES,
    openClawConfigJson: OPENCLAW_CONFIG_JSON,
  };
}
