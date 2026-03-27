/**
 * Shared integration metadata — used by API, web, and docs.
 */

export type IntegrationScenario =
  | "sdk_wrapper"
  | "local_companion"
  | "server_sidecar"
  | "event_ingestion";

export type IntegrationCardDefinition = {
  id: string;
  title: string;
  scenario: IntegrationScenario;
  /** Short “Best for …” chip */
  recommendedFor: string[];
  requiresCodeChanges: boolean;
  requiresCustomEndpoint: boolean;
  runsWhere: "app_process" | "desktop_localhost" | "server_vm" | "analytics_only";
  directProviderBilling: boolean;
  promptsStayLocalByDefault: boolean;
  realTimeSavingsSupported: boolean;
  observeModeSupported: boolean;
  onModeSupported: boolean;
  supportedToolsExamples: string[];
  setupComplexity: "easy" | "medium" | "advanced";
  heroSummary: string;
  simpleHowItWorks: string[];
  setupSteps: string[];
  verificationSteps: string[];
  securityNotes: string[];
  troubleshootingTips: string[];
  copyableConfigSnippets?: Array<{
    label: string;
    language: string;
    content: string;
  }>;
};

/** Quick comparison row for landing (one row per scenario card) */
export type IntegrationComparisonRow = {
  id: string;
  codeChanges: boolean;
  runsLocally: boolean;
  directProviderBilling: boolean;
  realTimeSavings: boolean;
  goodForOpenClaw: boolean;
  goodForServerAgents: boolean;
  goodForSdkApps: boolean;
};

/** Extended page for /integrations/:slug */
export type IntegrationPageDefinition = {
  slug: string;
  scenario: IntegrationScenario;
  title: string;
  navLabel: string;
  heroSummary: string;
  /** One-line flow, e.g. Tool → Spectyra → Provider */
  flowLine: string;
  whatThisIs: string[];
  howItWorks: string[];
  bestFor: string[];
  securitySection: string[];
  setupSteps: string[];
  verificationSteps: string[];
  commonMistakes: string[];
  trustLabels: string[];
  whatYouWillSee: string[];
  ctas: Array<{ label: string; route?: string; href?: string; external?: boolean }>;
  copyableConfigSnippets?: Array<{
    label: string;
    language: string;
    content: string;
  }>;
};

export type IntegrationsPayload = {
  version: "1";
  heroTitle: string;
  heroSubtitle: string;
  trustLabels: readonly string[];
  comparisonRows: IntegrationComparisonRow[];
  scenarios: IntegrationCardDefinition[];
  pages: IntegrationPageDefinition[];
  openClawConfigJson: string;
};
