/**
 * Provider Resolution Utility
 * 
 * Enforces strict provider key policy:
 * 1. BYOK header key (X-PROVIDER-KEY) - first priority
 * 2. Vaulted key from DB (org/project/provider) - second priority
 * 3. Environment fallback - ONLY if ALLOW_ENV_PROVIDER_KEYS=true (dev/demo only)
 * 4. Error if no key available
 * 
 * CRITICAL: In production, Spectyra NEVER pays for customer LLM tokens.
 * Customers MUST provide their own keys (BYOK or vault).
 */

import { config } from "../../config.js";
import { createProviderWithKey } from "./providerFactory.js";
import { providerRegistry } from "./providerRegistry.js";
import { getProviderCredential } from "../storage/providerCredentialsRepo.js";
import { safeLog } from "../../utils/redaction.js";
import type { ChatProvider } from "./types.js";

export type ProviderName = "openai" | "anthropic" | "gemini" | "grok" | "google" | "azure" | "aws";

export interface ProviderResolutionContext {
  /** Organization ID (from auth context) */
  orgId?: string;
  /** Project ID (from auth context, can be null) */
  projectId?: string | null;
  /** BYOK key from X-PROVIDER-KEY header */
  byokKey?: string;
  /** Requested provider name */
  providerName: string;
}

export interface ProviderResolutionResult {
  /** Resolved provider instance (if successful) */
  provider?: ChatProvider;
  /** Error message (if failed) */
  error?: string;
  /** HTTP status code for error */
  statusCode?: number;
  /** Key source for audit/debugging */
  keySource?: "byok" | "vault" | "env";
}

/**
 * Resolve a provider with strict key enforcement.
 * 
 * Order of precedence:
 * 1. BYOK header key (if provided)
 * 2. Vaulted key (if org has one stored)
 * 3. Environment key (ONLY if ALLOW_ENV_PROVIDER_KEYS=true)
 * 4. Error with 401/400
 * 
 * @param ctx Resolution context
 * @returns Resolution result with provider or error
 */
export async function resolveProvider(ctx: ProviderResolutionContext): Promise<ProviderResolutionResult> {
  const { orgId, projectId, byokKey, providerName } = ctx;
  
  // Normalize provider name
  const normalizedProvider = normalizeProviderName(providerName);
  if (!normalizedProvider) {
    return {
      error: `Unknown provider: ${providerName}. Supported providers: openai, anthropic, gemini, grok`,
      statusCode: 400,
    };
  }
  
  // 1. Try BYOK header key first
  if (byokKey) {
    const provider = createProviderWithKey(normalizedProvider, byokKey);
    if (provider) {
      safeLog("info", "Provider resolved via BYOK", { provider: normalizedProvider });
      return {
        provider,
        keySource: "byok",
      };
    }
    return {
      error: `Provider ${normalizedProvider} not supported for BYOK`,
      statusCode: 400,
    };
  }
  
  // 2. Try vaulted key (if org context available)
  if (orgId) {
    try {
      // Map provider name to credential type
      const credentialProvider = mapProviderToCredentialType(normalizedProvider);
      if (credentialProvider) {
        const vaultedKey = await getProviderCredential(
          orgId,
          projectId || null,
          credentialProvider
        );
        
        if (vaultedKey) {
          const provider = createProviderWithKey(normalizedProvider, vaultedKey);
          if (provider) {
            safeLog("info", "Provider resolved via vault", { 
              provider: normalizedProvider,
              orgId,
            });
            return {
              provider,
              keySource: "vault",
            };
          }
        }
      }
    } catch (error: any) {
      // Log but continue to next fallback
      safeLog("warn", "Vault key lookup failed", { 
        provider: normalizedProvider,
        orgId,
        error: error.message,
      });
    }
  }
  
  // 3. Check if env fallback is allowed
  if (config.allowEnvProviderKeys) {
    const provider = providerRegistry.get(normalizedProvider);
    if (provider) {
      safeLog("warn", "Provider resolved via ENV fallback (dev/demo mode)", { 
        provider: normalizedProvider,
        orgId,
      });
      return {
        provider,
        keySource: "env",
      };
    }
  }
  
  // 4. No key available - return clear error
  const errorMessage = config.allowEnvProviderKeys
    ? `Provider ${normalizedProvider} not available. Provide X-PROVIDER-KEY header for BYOK or configure vaulted key.`
    : `Provider key required. Spectyra does not pay for customer LLM tokens. Please provide your own API key via X-PROVIDER-KEY header (BYOK) or configure a vaulted key for your organization.`;
  
  safeLog("warn", "Provider resolution failed - no key available", {
    provider: normalizedProvider,
    orgId,
    hasByokKey: !!byokKey,
    allowEnvFallback: config.allowEnvProviderKeys,
  });
  
  return {
    error: errorMessage,
    statusCode: 401,
  };
}

/**
 * Resolve provider for optimizer (internal) use.
 * Used for embeddings and NLI which may use different resolution logic.
 */
export async function resolveOptimizerProvider(
  providerName: string,
  byokKey?: string
): Promise<ProviderResolutionResult> {
  // For optimizer internal use, we can use env keys since embeddings/NLI
  // are Spectyra-hosted services, not customer LLM calls
  const normalizedProvider = normalizeProviderName(providerName);
  if (!normalizedProvider) {
    return {
      error: `Unknown provider: ${providerName}`,
      statusCode: 400,
    };
  }
  
  if (byokKey) {
    const provider = createProviderWithKey(normalizedProvider, byokKey);
    if (provider) {
      return { provider, keySource: "byok" };
    }
  }
  
  const provider = providerRegistry.get(normalizedProvider);
  if (provider) {
    return { provider, keySource: "env" };
  }
  
  return {
    error: `Provider ${normalizedProvider} not available`,
    statusCode: 400,
  };
}

/**
 * Normalize provider name to standard form
 */
function normalizeProviderName(name: string): ProviderName | null {
  const normalized = name.toLowerCase().trim();
  
  switch (normalized) {
    case "openai":
      return "openai";
    case "anthropic":
    case "claude":
      return "anthropic";
    case "gemini":
    case "google":
      return "gemini";
    case "grok":
    case "xai":
    case "x.ai":
      return "grok";
    default:
      return null;
  }
}

/**
 * Map provider name to credential type for vault lookup
 */
function mapProviderToCredentialType(
  provider: ProviderName
): "openai" | "anthropic" | "google" | "azure" | "aws" | null {
  switch (provider) {
    case "openai":
      return "openai";
    case "anthropic":
      return "anthropic";
    case "gemini":
    case "google":
      return "google";
    case "grok":
      // Grok (xAI) doesn't have a specific vault type yet
      // Could be added as "xai" in future
      return null;
    default:
      return null;
  }
}

/**
 * Check if provider key enforcement is enabled (production mode)
 */
export function isProviderKeyEnforcementEnabled(): boolean {
  return !config.allowEnvProviderKeys;
}

/**
 * Get human-readable description of key enforcement mode
 */
export function getKeyEnforcementMode(): string {
  return config.allowEnvProviderKeys
    ? "DEV_MODE (env fallback allowed)"
    : "PRODUCTION (BYOK or vault required)";
}
