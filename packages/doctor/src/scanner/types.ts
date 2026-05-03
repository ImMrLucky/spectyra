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

export interface DoctorScanResult {
  projectRoot: string;
  packageManager?: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  projectType?: "node" | "python" | "mixed" | "unknown";
  frameworks: DetectedFramework[];
  providers: DetectedProvider[];
  aiCallSites: AiCallSite[];
  entrypoints: Entrypoint[];
  spectyraStatus: SpectyraStatus;
  recommendations: IntegrationRecommendation[];
  warnings: DoctorWarning[];
  userPlacement?: UserPlacementAnswer;
}

export type ProgressEvent = {
  type: "progress" | "finding" | "warning" | "result" | "error";
  message: string;
  data?: unknown;
};

export type ScanProgressFn = (ev: ProgressEvent) => void;
