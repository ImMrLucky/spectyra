/**
 * Organization and Settings Types
 * 
 * Canonical types for org-related entities used across apps and packages
 */

import type { Org, Project, ApiKey } from "./types";

/**
 * Canonical OrgSettings type - full database representation (Row)
 */
export interface OrgSettingsRow {
  org_id: string;
  data_retention_days: number;
  store_prompts: boolean;
  store_responses: boolean;
  store_internal_debug: boolean;
  allow_semantic_cache: boolean;
  allowed_ip_ranges: string[] | null;
  enforce_sso: boolean;
  allowed_email_domains: string[] | null;
  provider_key_mode: "BYOK_ONLY" | "VAULT_ONLY" | "EITHER";
  created_at: string;
  updated_at: string;
}

/**
 * Canonical ProjectSettings type - full database representation (Row)
 */
export interface ProjectSettingsRow {
  project_id: string;
  allowed_origins: string[] | null;
  rate_limit_rps: number;
  rate_limit_burst: number;
  created_at: string;
  updated_at: string;
}

/**
 * Web API DTOs - subset types for API responses (omits IDs and timestamps)
 */
export type OrgSettingsDTO = Omit<OrgSettingsRow, "org_id" | "created_at" | "updated_at">;
export type ProjectSettingsDTO = Omit<ProjectSettingsRow, "project_id" | "created_at" | "updated_at">;

/**
 * Web UI DTOs - types that match API responses (may have fewer fields than canonical types)
 */
export interface OrgSummary {
  id: string;
  name: string;
  subscription_status: string; // API returns string, not union type
  trial_ends_at?: string | null; // Optional for summary, required for OrgWithTrial
}

export interface OrgWithTrial extends OrgSummary {
  trial_ends_at: string | null; // Required
}

export interface ProjectSummary {
  id: string;
  name: string;
  org_id: string;
  created_at?: string; // Optional - API may not always return this
}

export interface ApiKeySummary {
  id: string;
  name: string | null;
  project_id: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/**
 * UI Display Types - for components that need display-specific types
 */
export type OrgDisplay = OrgSummary & { trial_ends_at?: string | null };
export type ProjectDisplay = ProjectSummary;
export type ApiKeyDisplay = ApiKeySummary;

// Also support OrgWithTrial as OrgDisplay (for settings page)
export type { OrgWithTrial as OrgDisplaySettings };
