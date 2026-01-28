/**
 * Envelope Encryption Service
 * 
 * Enterprise Security: Encrypts provider keys at rest using AES-256-GCM
 * 
 * Envelope encryption pattern:
 * - Master key (from env) encrypts provider keys
 * - Each encrypted key includes IV, ciphertext, tag, and key ID
 * - Supports key rotation via key ID
 */

import crypto from "node:crypto";
import { safeLog } from "../../utils/redaction.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits for GCM tag
const KEY_LENGTH = 32; // 256 bits

export interface EncryptedKey {
  iv: string; // Base64 IV
  ciphertext: string; // Base64 encrypted key
  tag: string; // Base64 authentication tag
  kid: string; // Key ID for rotation
}

/**
 * Get master encryption key from environment
 */
function getMasterKey(): Buffer {
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) {
    throw new Error("MASTER_KEY environment variable is required for provider key encryption");
  }

  // Support base64 encoded key
  let keyBuffer: Buffer;
  try {
    keyBuffer = Buffer.from(masterKey, "base64");
  } catch {
    // If not base64, treat as hex or use directly (not recommended)
    keyBuffer = Buffer.from(masterKey, "utf8");
  }

  // Ensure key is exactly 32 bytes (256 bits)
  if (keyBuffer.length !== KEY_LENGTH) {
    // Hash to 32 bytes if needed
    keyBuffer = crypto.createHash("sha256").update(keyBuffer).digest();
  }

  return keyBuffer;
}

/**
 * Get current key ID (for rotation support)
 * Defaults to "v1" for now
 */
function getCurrentKeyId(): string {
  return process.env.MASTER_KEY_ID || "v1";
}

/**
 * Encrypt a provider key
 * 
 * @param plaintextKey Provider API key in plaintext
 * @returns Encrypted key with IV, ciphertext, tag, and key ID
 */
export function encryptKey(plaintextKey: string): EncryptedKey {
  try {
    const masterKey = getMasterKey();
    const keyId = getCurrentKeyId();

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

    // Encrypt
    let ciphertext = cipher.update(plaintextKey, "utf8", "base64");
    ciphertext += cipher.final("base64");

    // Get authentication tag
    const tag = cipher.getAuthTag().toString("base64");

    return {
      iv: iv.toString("base64"),
      ciphertext,
      tag,
      kid: keyId,
    };
  } catch (error: any) {
    safeLog("error", "Failed to encrypt provider key", { error: error.message });
    throw new Error("Failed to encrypt provider key");
  }
}

/**
 * Decrypt a provider key
 * 
 * @param encrypted Encrypted key structure
 * @returns Plaintext provider key
 */
export function decryptKey(encrypted: EncryptedKey): string {
  try {
    const masterKey = getMasterKey();

    // Decode IV and tag
    const iv = Buffer.from(encrypted.iv, "base64");
    const tag = Buffer.from(encrypted.tag, "base64");

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let plaintext = decipher.update(encrypted.ciphertext, "base64", "utf8");
    plaintext += decipher.final("utf8");

    return plaintext;
  } catch (error: any) {
    safeLog("error", "Failed to decrypt provider key", {
      error: error.message,
      kid: encrypted.kid,
    });
    throw new Error("Failed to decrypt provider key");
  }
}

/**
 * Compute provider key fingerprint for audit
 * Format: SHA256(last6 + org_id + salt)
 */
export function computeProviderKeyFingerprint(
  providerKey: string,
  orgId: string
): string {
  const salt = process.env.PROVIDER_KEY_SALT || "spectyra-audit-salt";
  const last6 = providerKey.slice(-6);
  const input = `${last6}:${orgId}:${salt}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}
