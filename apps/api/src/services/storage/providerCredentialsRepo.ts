/**
 * Provider Credentials Repository
 * 
 * Manages encrypted provider API keys (BYOK mode)
 */

import { query, queryOne, tx } from "./db.js";
import { encryptKey, decryptKey, computeProviderKeyFingerprint, type EncryptedKey } from "../crypto/envelope.js";
import { safeLog } from "../../utils/redaction.js";
import type { ProviderCredentialRow } from "@spectyra/shared";

/**
 * Set or update a provider credential
 * Revokes any existing active credential for the same org/project/provider
 */
export async function setProviderCredential(
  orgId: string,
  projectId: string | null,
  provider: ProviderCredentialRow["provider"],
  plaintextKey: string
): Promise<ProviderCredentialRow> {
  // Encrypt the key
  const encrypted = encryptKey(plaintextKey);
  const fingerprint = computeProviderKeyFingerprint(plaintextKey, orgId);

  return await tx(async (client) => {
    // Revoke any existing active credential
    await client.query(`
      UPDATE provider_credentials
      SET revoked_at = now()
      WHERE org_id = $1
        AND (project_id = $2 OR (project_id IS NULL AND $2 IS NULL))
        AND provider = $3
        AND revoked_at IS NULL
    `, [orgId, projectId, provider]);

    // Insert new credential
    const result = await client.query<ProviderCredentialRow>(`
      INSERT INTO provider_credentials (
        org_id, project_id, provider,
        key_ciphertext, key_kid, key_fingerprint
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, org_id, project_id, provider, key_ciphertext, key_kid, key_fingerprint,
                created_at, updated_at, revoked_at
    `, [
      orgId,
      projectId,
      provider,
      JSON.stringify(encrypted),
      encrypted.kid,
      fingerprint,
    ]);

    return result.rows[0];
  });
}

/**
 * Get active provider credential (decrypted)
 * Returns null if no active credential exists
 */
export async function getProviderCredential(
  orgId: string,
  projectId: string | null,
  provider: ProviderCredentialRow["provider"]
): Promise<string | null> {
  const credential = await queryOne<ProviderCredentialRow>(`
    SELECT id, org_id, project_id, provider, key_ciphertext, key_kid, key_fingerprint,
           created_at, updated_at, revoked_at
    FROM provider_credentials
    WHERE org_id = $1
      AND (project_id = $2 OR (project_id IS NULL AND $2 IS NULL))
      AND provider = $3
      AND revoked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `, [orgId, projectId, provider]);

  if (!credential) {
    return null;
  }

  try {
    const encrypted: EncryptedKey = JSON.parse(credential.key_ciphertext);
    return decryptKey(encrypted);
  } catch (error: any) {
    safeLog("error", "Failed to decrypt provider credential", {
      credentialId: credential.id,
      provider,
      error: error.message,
    });
    throw new Error("Failed to decrypt provider credential");
  }
}

/**
 * List provider credentials for an org (masked - no plaintext)
 */
export async function listProviderCredentials(
  orgId: string,
  projectId?: string | null
): Promise<Array<{
  id: string;
  provider: string;
  key_fingerprint: string;
  created_at: string;
  revoked_at: string | null;
}>> {
  const conditions = ["org_id = $1"];
  const params: any[] = [orgId];
  let paramIndex = 2;

  if (projectId !== undefined) {
    if (projectId === null) {
      conditions.push("project_id IS NULL");
    } else {
      conditions.push(`project_id = $${paramIndex++}`);
      params.push(projectId);
    }
  }

  const result = await query<{
    id: string;
    provider: string;
    key_fingerprint: string;
    created_at: string;
    revoked_at: string | null;
  }>(`
    SELECT id, provider, key_fingerprint, created_at, revoked_at
    FROM provider_credentials
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC
  `, params);

  return result.rows;
}

/**
 * Revoke a provider credential
 */
export async function revokeProviderCredential(
  credentialId: string,
  orgId: string
): Promise<void> {
  const result = await query(`
    UPDATE provider_credentials
    SET revoked_at = now()
    WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL
  `, [credentialId, orgId]);

  if (result.rowCount === 0) {
    throw new Error("Provider credential not found or already revoked");
  }
}
