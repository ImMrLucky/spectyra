export type UserPlacementAnswer = "backend" | "frontend" | "both" | "not_sure";

export interface Evidence {
  kind: "url" | "env" | "import" | "pattern" | "file";
  detail: string;
  file?: string;
  line?: number;
}

export interface DetectedFramework {
  id: string;
  confidence: "high" | "medium" | "low";
  evidence: Evidence[];
}

export interface DetectedProvider {
  provider:
    | "openai"
    | "anthropic"
    | "groq"
    | "google-gemini"
    | "azure-openai"
    | "aws-bedrock"
    | "mistral"
    | "cohere"
    | "openrouter"
    | "together"
    | "perplexity"
    | "ollama"
    | "unknown-openai-compatible";
  confidence: "high" | "medium" | "low";
  evidence: Evidence[];
}

export interface AiCallSite {
  file: string;
  line?: number;
  kind:
    | "fetch"
    | "axios"
    | "http"
    | "https"
    | "openai-sdk"
    | "anthropic-sdk"
    | "groq-sdk"
    | "gemini-sdk"
    | "bedrock-sdk"
    | "ollama"
    | "langchain"
    | "llamaindex"
    | "vercel-ai-sdk"
    | "unknown";
  provider?: string;
  modelHint?: string;
  urlHint?: string;
  envVars: string[];
  confidence: "high" | "medium" | "low";
  snippet?: string;
}

export interface Entrypoint {
  file: string;
  framework?:
    | "nestjs"
    | "express"
    | "fastify"
    | "koa"
    | "nextjs"
    | "vite"
    | "angular"
    | "react"
    | "python-fastapi"
    | "python-flask"
    | "python-django"
    | "unknown";
  type: "backend" | "frontend" | "fullstack" | "worker" | "unknown";
  confidence: "high" | "medium" | "low";
}

export interface SpectyraStatus {
  /** @deprecated Prefer {@link sdkInstalled} + {@link sdkAutoImportFiles}. */
  autoInstalled: boolean;
  sdkInstalled: boolean;
  devtoolsInstalled: boolean;
  doctorInstalled?: boolean;
  /** Files importing legacy `@spectyra/auto`. */
  legacyAutoImportFiles: string[];
  /** Files importing `@spectyra/sdk/auto` (recommended). */
  sdkAutoImportFiles: string[];
  /** Files importing `@spectyra/devtools` or `/devtools/auto`. */
  devtoolsImportFiles: string[];
  /** @deprecated Use {@link sdkAutoImportFiles} or {@link legacyAutoImportFiles}. */
  autoImportFiles: string[];
  hasDevBridge: boolean;
  hasStartSpectyraAuto: boolean;
  possibleLateImport: boolean;
  issues: string[];
  /** Non-blocking guidance (e.g. migration from legacy packages). */
  info: string[];
}

export interface DoctorWarning {
  code: string;
  message: string;
  severity: "info" | "warn" | "error";
  file?: string;
}

export interface IntegrationRecommendation {
  id: string;
  title: string;
  summary: string;
  targetFile?: string;
  codeBlocks: Array<{ title: string; language: string; code: string }>;
  rank: number;
}

export type AiProviderId =
  | "openai"
  | "anthropic"
  | "groq"
  | "gemini"
  | "azure-openai"
  | "aws-bedrock"
  | "openrouter"
  | "together"
  | "mistral"
  | "cohere"
  | "perplexity"
  | "ollama"
  | "huggingface"
  | "replicate"
  | "deepseek"
  | "xai"
  | "fireworks"
  | "elevenlabs"
  | "vercel-ai-sdk"
  | "langchain"
  | "llamaindex"
  | "litellm"
  | "custom-gateway"
  | "openai-compatible"
  | "unknown";

export type AiUsageType =
  | "chat"
  | "responses"
  | "completion"
  | "embedding"
  | "rerank"
  | "image"
  | "audio"
  | "moderation"
  | "agent"
  | "tool-calling"
  | "streaming"
  | "batch"
  | "unknown";

export type AiCallStyle = "sdk" | "http" | "framework" | "custom-wrapper" | "config" | "env" | "unknown";

export interface ModelClassification {
  raw: string;
  provider: string;
  family?: string;
  capability?: "chat" | "reasoning" | "embedding" | "image" | "audio" | "rerank" | "unknown";
  costProfile?: "low" | "medium" | "high" | "unknown";
  spectyraStrategyHints: string[];
}

export interface SpectyraRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  summary: string;
  installPackage?: string;
  setupLocation?: string;
  wrapperLocation?: string;
  suggestedImport?: string;
  suggestedCode?: string;
  notes: string[];
  estimatedEffort: "5 minutes" | "15 minutes" | "30 minutes" | "1 hour+";
  confidence: number;
}

export type DoctorStepStatus = "pending" | "complete" | "warning" | "ready" | "blocked";

export type DoctorStepKind =
  | "install-sdk"
  | "add-auto-import"
  | "wrap-llm-call"
  | "wrap-central-client"
  | "add-monitor-config"
  | "run-app"
  | "verify"
  | "open-monitor";

export interface DoctorCodeBlock {
  title: string;
  language: "bash" | "ts" | "tsx" | "js" | "jsx" | "py" | "json" | "text";
  code: string;
  copyLabel?: string;
}

export interface DoctorIntegrationStep {
  id: string;
  kind: DoctorStepKind;
  status: DoctorStepStatus;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  summary: string;
  targetFile?: string;
  targetLine?: number;
  packageDir?: string;
  provider?: AiProviderId;
  usageType?: AiUsageType;
  callStyle?: AiCallStyle;
  modelHints?: string[];
  codeBlocks: DoctorCodeBlock[];
  verifyChecks: string[];
  notes: string[];
  nextAction: string;
}

export interface DoctorIntegrationPlan {
  status: "not-started" | "in-progress" | "needs-attention" | "ready";
  headline: string;
  summary: string;
  score: number;
  blockers: string[];
  completed: string[];
  steps: DoctorIntegrationStep[];
  readyMessage?: string;
  monitorNextSteps: DoctorIntegrationStep[];
}

export interface DoctorProgressDelta {
  sdkInstalledChanged?: boolean;
  autoImportAdded?: string[];
  wrappersAdded?: string[];
  remainingUnwrappedFindings?: number;
  newlyDetectedRisks?: DoctorRisk[];
}

export interface AiUsageFinding {
  id: string;
  filePath: string;
  relativePath: string;
  line: number;
  column?: number;
  language: string;
  provider: AiProviderId;
  providerEvidence: string[];
  usageType: AiUsageType;
  callStyle: AiCallStyle;
  methodName?: string;
  importName?: string;
  clientName?: string;
  modelHints: string[];
  envHints: string[];
  urlHints: string[];
  isStreaming?: boolean;
  isServerSideLikely?: boolean;
  isClientSideLikely?: boolean;
  confidence: number;
  severity: "high" | "medium" | "low";
  snippet: string;
  recommendation: SpectyraRecommendation;
  packageDir?: string;
}

export interface IntegrationPoint {
  filePath: string;
  relativePath: string;
  type:
    | "server-entrypoint"
    | "api-route"
    | "llm-wrapper"
    | "provider-client"
    | "frontend-entrypoint"
    | "config";
  confidence: number;
  reason: string;
  suggestedAction: string;
}

export interface PackageFinding {
  packageDir: string;
  /** Same as packageDir; stable alias for UI/report consumers. */
  relativePath: string;
  manifestPath: string;
  name?: string;
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  hasSpectyraSdk: boolean;
  hasSpectyraAutoImport: boolean;
  /** Declares deprecated `@spectyra/auto` in package.json. */
  hasLegacySpectyraAuto: boolean;
  /** Declares `@spectyra/devtools` in package.json. */
  hasLegacySpectyraDevtools: boolean;
  aiDependencyHints: string[];
  /** Populated after AI scan. */
  aiFindingCount: number;
  /** Workspace-safe install hint when SDK is missing (empty when already present). */
  installCommand: string;
}

export interface DoctorRisk {
  level: "high" | "medium" | "low";
  title: string;
  detail: string;
  filePath?: string;
  line?: number;
  fix?: string;
}

export interface ScannableFile {
  path: string;
  relativePath: string;
  extension?: string;
  language?: string;
  sizeBytes: number;
  reason: string;
}

export interface DoctorScanReport {
  projectRoot: string;
  scannedAt: string;
  packageManager?: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  projectType?: "node" | "python" | "mixed" | "unknown";
  summary: {
    filesScanned: number;
    /** Total skip rows from the file walker (includes ignored directories as boundary rows). */
    filesSkipped?: number;
    directoriesSkipped?: number;
    symlinksSkipped?: number;
    secretFilesSkipped?: number;
    binariesSkipped?: number;
    oversizedSkipped?: number;
    lockfilesSkipped?: number;
    permissionOrReadWarnings?: number;
    aiFindings: number;
    highConfidenceFindings: number;
    providers: Record<string, number>;
    usageTypes: Record<string, number>;
    modelsDetected: string[];
    packagesWithAiUsage: string[];
    spectyraInstalled: boolean;
    spectyraAutoDetected: boolean;
    recommendedNextStep: string;
  };
  packages: PackageFinding[];
  /** Unique relative paths where AI usage or integration work was detected (not the full file list). */
  actionableFilePaths: string[];
  aiFindings: AiUsageFinding[];
  integrationPoints: IntegrationPoint[];
  recommendations: SpectyraRecommendation[];
  integrationPlan: DoctorIntegrationPlan;
  risks: DoctorRisk[];
  frameworks: DetectedFramework[];
  providers: DetectedProvider[];
  entrypoints: Entrypoint[];
  spectyraStatus: SpectyraStatus;
  warnings: DoctorWarning[];
  userPlacement?: UserPlacementAnswer;
  aiCallSites: AiCallSite[];
  /** File walk telemetry (exclusion-first scan). */
  fileWalk?: DoctorFileWalkSummary;
}

/** Aggregated output from the exclusion-first file walker; see {@link DoctorScanReport.fileWalk}. */
export interface DoctorFileWalkSummary {
  rootDir: string;
  directoriesSkipped: string[];
  skippedTotal: number;
  skippedByReason: Record<string, number>;
  skippedSample: Array<{ relativePath: string; reason: string; detail?: string }>;
  permissionOrReadErrors: number;
  walkWarnings: string[];
}

/** @alias DoctorScanReport */
export type DoctorScanResult = DoctorScanReport;

export type ProgressEvent = {
  type: "progress" | "finding" | "warning" | "result" | "error";
  message: string;
  data?: unknown;
};

export type ScanProgressFn = (ev: ProgressEvent) => void;
