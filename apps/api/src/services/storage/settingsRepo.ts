/**
 * Settings Repository
 * 
 * Manages org_settings and project_settings for enterprise security controls
 */

import { query, queryOne } from "./db.js";

export interface OrgSettings {
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

export interface ProjectSettings {
  project_id: string;
  allowed_origins: string[] | null;
  rate_limit_rps: number;
  rate_limit_burst: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get org settings (creates defaults if not exist)
 */
export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  let settings = await queryOne<OrgSettings>(`
    SELECT org_id, data_retention_days, store_prompts, store_responses, store_internal_debug,
           allow_semantic_cache, allowed_ip_ranges, enforce_sso, allowed_email_domains,
           provider_key_mode, created_at, updated_at
    FROM org_settings
    WHERE org_id = $1
  `, [orgId]);

  if (!settings) {
    // Create defaults
    await query(`
      INSERT INTO org_settings (org_id)
      VALUES ($1)
      ON CONFLICT (org_id) DO NOTHING
    `, [orgId]);

    settings = await queryOne<OrgSettings>(`
      SELECT org_id, data_retention_days, store_prompts, store_responses, store_internal_debug,
             allow_semantic_cache, allowed_ip_ranges, enforce_sso, allowed_email_domains,
             provider_key_mode, created_at, updated_at
      FROM org_settings
      WHERE org_id = $1
    `, [orgId]);
  }

  if (!settings) {
    throw new Error("Failed to get or create org settings");
  }

  return settings;
}

/**
 * Update org settings
 */
export async function updateOrgSettings(
  orgId: string,
  updates: Partial<Omit<OrgSettings, "org_id" | "created_at" | "updated_at">>
): Promise<OrgSettings> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.data_retention_days !== undefined) {
    fields.push(`data_retention_days = $${paramIndex++}`);
    values.push(updates.data_retention_days);
  }
  if (updates.store_prompts !== undefined) {
    fields.push(`store_prompts = $${paramIndex++}`);
    values.push(updates.store_prompts);
  }
  if (updates.store_responses !== undefined) {
    fields.push(`store_responses = $${paramIndex++}`);
    values.push(updates.store_responses);
  }
  if (updates.store_internal_debug !== undefined) {
    fields.push(`store_internal_debug = $${paramIndex++}`);
    values.push(updates.store_internal_debug);
  }
  if (updates.allow_semantic_cache !== undefined) {
    fields.push(`allow_semantic_cache = $${paramIndex++}`);
    values.push(updates.allow_semantic_cache);
  }
  if (updates.allowed_ip_ranges !== undefined) {
    fields.push(`allowed_ip_ranges = $${paramIndex++}`);
    values.push(updates.allowed_ip_ranges);
  }
  if (updates.enforce_sso !== undefined) {
    fields.push(`enforce_sso = $${paramIndex++}`);
    values.push(updates.enforce_sso);
  }
  if (updates.allowed_email_domains !== undefined) {
    fields.push(`allowed_email_domains = $${paramIndex++}`);
    values.push(updates.allowed_email_domains);
  }
  if (updates.provider_key_mode !== undefined) {
    fields.push(`provider_key_mode = $${paramIndex++}`);
    values.push(updates.provider_key_mode);
  }

  if (fields.length === 0) {
    return getOrgSettings(orgId);
  }

  values.push(orgId);

  await query(`
    UPDATE org_settings
    SET ${fields.join(", ")}
    WHERE org_id = $${paramIndex}
  `, values);

  return getOrgSettings(orgId);
}

/**
 * Get project settings (creates defaults if not exist)
 */
export async function getProjectSettings(projectId: string): Promise<ProjectSettings> {
  let settings = await queryOne<ProjectSettings>(`
    SELECT project_id, allowed_origins, rate_limit_rps, rate_limit_burst, created_at, updated_at
    FROM project_settings
    WHERE project_id = $1
  `, [projectId]);

  if (!settings) {
    // Create defaults
    await query(`
      INSERT INTO project_settings (project_id)
      VALUES ($1)
      ON CONFLICT (project_id) DO NOTHING
    `, [projectId]);

    settings = await queryOne<ProjectSettings>(`
      SELECT project_id, allowed_origins, rate_limit_rps, rate_limit_burst, created_at, updated_at
      FROM project_settings
      WHERE project_id = $1
    `, [projectId]);
  }

  if (!settings) {
    throw new Error("Failed to get or create project settings");
  }

  return settings;
}

/**
 * Update project settings
 */
export async function updateProjectSettings(
  projectId: string,
  updates: Partial<Omit<ProjectSettings, "project_id" | "created_at" | "updated_at">>
): Promise<ProjectSettings> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.allowed_origins !== undefined) {
    fields.push(`allowed_origins = $${paramIndex++}`);
    values.push(updates.allowed_origins);
  }
  if (updates.rate_limit_rps !== undefined) {
    fields.push(`rate_limit_rps = $${paramIndex++}`);
    values.push(updates.rate_limit_rps);
  }
  if (updates.rate_limit_burst !== undefined) {
    fields.push(`rate_limit_burst = $${paramIndex++}`);
    values.push(updates.rate_limit_burst);
  }

  if (fields.length === 0) {
    return getProjectSettings(projectId);
  }

  values.push(projectId);

  await query(`
    UPDATE project_settings
    SET ${fields.join(", ")}
    WHERE project_id = $${paramIndex}
  `, values);

  return getProjectSettings(projectId);
}
