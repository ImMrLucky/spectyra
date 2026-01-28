export type Path = "talk" | "code";
export type Mode = "baseline" | "optimized";
export type Provider = "openai" | "anthropic" | "gemini" | "grok";

/**
 * Provider interface for web UI (shows available providers)
 */
export interface ProviderInfo {
  name: string;
  models: string[];
  supportsUsage: boolean;
}

/**
 * Legacy Message type - for backward compatibility
 * Prefer ChatMessage for new code (supports tool role)
 */
export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Canonical ChatMessage type - used across optimizer, SDK, and agents
 * Supports all message roles including tool for agent workflows
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

/**
 * Canonical Org type - full database representation
 */
export interface Org {
  id: string;
  name: string;
  created_at: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  subscription_status: "trial" | "active" | "canceled" | "past_due";
  sdk_access_enabled: boolean;
}

/**
 * Canonical Project type - full database representation
 */
export interface Project {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

/**
 * Canonical ApiKey type - full database representation
 */
export interface ApiKey {
  id: string;
  org_id: string;
  project_id: string | null;
  name: string | null;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  allowed_ip_ranges: string[] | null;
  allowed_origins: string[] | null;
  description: string | null;
}

/**
 * Canonical User type - minimal representation for UI/auth
 * Note: The app uses org-based model, so User is primarily for Supabase auth
 */
export interface User {
  id: string;
  email: string;
  trial_ends_at: string | null;
  subscription_active: boolean;
}

/**
 * Full User type - complete database representation (for billing/admin)
 */
export interface UserFull extends User {
  created_at: string;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  updated_at: string;
}

export interface SemanticUnit {
  id: string;
  kind: "fact" | "constraint" | "explanation" | "code" | "patch";
  text: string;
  embedding?: number[];
  stabilityScore: number;
  createdAtTurn: number;
}

export interface ConversationState {
  conversationId: string;
  path: Path;
  units: SemanticUnit[];
  lastTurn: number;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated?: boolean;
}

export interface SpectralDebug {
  nNodes: number;
  nEdges: number;
  stabilityIndex: number;
  contradictionEnergy?: number;
  lambda2?: number;
  stableUnitIds: string[];
  unstableUnitIds: string[];
  recommendation: "REUSE" | "EXPAND" | "ASK_CLARIFY" | "STOP_EARLY";
}

export interface RunDebug {
  refsUsed?: string[];
  deltaUsed?: boolean;
  codeSliced?: boolean;
  patchMode?: boolean;
  spectral?: SpectralDebug;
  retry?: boolean;
  retry_reason?: string;
  first_failures?: string[];
}

export interface QualityCheck {
  pass: boolean;
  failures: string[];
}

export interface Savings {
  tokensSaved: number;
  pctSaved: number;
  costSavedUsd: number;
  savings_type?: "verified" | "estimated" | "shadow_verified" | "estimated_demo";
}

export interface RunRecord {
  id: string;
  scenarioId?: string;
  conversationId?: string;
  mode: Mode;
  path: Path;
  provider: string;
  model: string;
  promptFinal: any;
  responseText: string;
  usage: Usage;
  costUsd: number;
  savings?: Savings;
  quality: QualityCheck;
  debug: RunDebug;
  createdAt: string;
}

export interface ReplayResult {
  scenario_id: string;
  baseline: RunRecord;
  optimized: RunRecord;
  savings: Savings;
  quality: {
    baseline_pass: boolean;
    optimized_pass: boolean;
  };
}
