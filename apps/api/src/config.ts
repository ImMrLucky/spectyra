import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  databaseUrl: process.env.DATABASE_URL || "",
  
  // Supabase configuration
  supabase: {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    jwtSecret: process.env.SUPABASE_JWT_SECRET || "",
  },
  
  // ============================================================================
  // PROVIDER KEY ENFORCEMENT
  // ============================================================================
  // In production, Spectyra NEVER pays for customer LLM tokens.
  // Customers MUST provide their own keys (BYOK header or vaulted key).
  // Set ALLOW_ENV_PROVIDER_KEYS=true ONLY for local dev/demo environments.
  // Default: false (production-safe)
  // ============================================================================
  allowEnvProviderKeys: process.env.ALLOW_ENV_PROVIDER_KEYS === "true",
  
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY || "" },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY || "" },
    gemini: { apiKey: process.env.GEMINI_API_KEY || "" },
    grok: { apiKey: process.env.GROK_API_KEY || "" },
  },
  
  defaults: {
    talkProvider: (process.env.DEFAULT_TALK_PROVIDER || "openai") as "openai" | "anthropic" | "gemini" | "grok",
    talkModel: process.env.DEFAULT_TALK_MODEL || "gpt-4o-mini",
    codeProvider: (process.env.DEFAULT_CODE_PROVIDER || "anthropic") as "openai" | "anthropic" | "gemini" | "grok",
    codeModel: process.env.DEFAULT_CODE_MODEL || "claude-3-5-sonnet-20241022",
  },
  
  // ============================================================================
  // EMBEDDINGS CONFIGURATION (LOCAL/OPEN-SOURCE)
  // ============================================================================
  // Spectyra uses local/HTTP open-source embeddings for optimization.
  // EMBEDDINGS_PROVIDER: "local" (HTTP to local TEI) | "http" (custom endpoint)
  // Default: "local" (uses EMBEDDINGS_HTTP_URL)
  // ============================================================================
  embeddings: {
    provider: (process.env.EMBEDDINGS_PROVIDER || "local") as "local" | "http" | "openai",
    httpUrl: process.env.EMBEDDINGS_HTTP_URL || "http://localhost:8081",
    httpToken: process.env.EMBEDDINGS_HTTP_TOKEN || "",
    model: process.env.EMBEDDINGS_MODEL || "BAAI/bge-large-en-v1.5",
    // Legacy OpenAI model (only used if EMBEDDINGS_PROVIDER=openai for dev/testing)
    openaiModel: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
    // Caching
    cacheEnabled: process.env.EMBEDDINGS_CACHE_ENABLED !== "false", // default true
    cacheTtlDays: parseInt(process.env.EMBEDDINGS_CACHE_TTL_DAYS || "30", 10),
  },
  
  // ============================================================================
  // NLI CONFIGURATION (LOCAL/OPEN-SOURCE)
  // ============================================================================
  // Spectyra uses local/HTTP open-source NLI models for contradiction detection.
  // NLI_PROVIDER: "local" | "http" | "disabled"
  // Default: "local" (uses NLI_HTTP_URL)
  // ============================================================================
  nli: {
    provider: (process.env.NLI_PROVIDER || "local") as "local" | "http" | "disabled",
    httpUrl: process.env.NLI_HTTP_URL || "http://localhost:8082",
    httpToken: process.env.NLI_HTTP_TOKEN || "",
    model: process.env.NLI_MODEL || "microsoft/deberta-v3-large-mnli",
    // Timeout for NLI requests (ms)
    timeoutMs: parseInt(process.env.NLI_TIMEOUT_MS || "10000", 10),
  },
  
  pricing: {
    openai: {
      input: parseFloat(process.env.PRICE_OPENAI_INPUT || "0.003"),
      output: parseFloat(process.env.PRICE_OPENAI_OUTPUT || "0.015"),
    },
    anthropic: {
      input: parseFloat(process.env.PRICE_ANTHROPIC_INPUT || "0.003"),
      output: parseFloat(process.env.PRICE_ANTHROPIC_OUTPUT || "0.015"),
    },
    gemini: {
      input: parseFloat(process.env.PRICE_GEMINI_INPUT || "0.00025"),
      output: parseFloat(process.env.PRICE_GEMINI_OUTPUT || "0.001"),
    },
    grok: {
      input: parseFloat(process.env.PRICE_GROK_INPUT || "0.001"),
      output: parseFloat(process.env.PRICE_GROK_OUTPUT || "0.002"),
    },
  },
  
  optimizer: {
    similarityReuseThreshold: parseFloat(process.env.SIMILARITY_REUSE_THRESHOLD || "0.90"),
    stabilityTLow: parseFloat(process.env.STABILITY_T_LOW || "0.35"),
    stabilityTHigh: parseFloat(process.env.STABILITY_T_HIGH || "0.70"),
    maxOutputTokensOptimized: parseInt(process.env.MAX_OUTPUT_TOKENS_OPTIMIZED || "450", 10),
    codePatchModeDefault: process.env.CODE_PATCH_MODE_DEFAULT === "true",
  },
  
  // ============================================================================
  // CACHE CONFIGURATION (REDIS/POSTGRES)
  // ============================================================================
  cache: {
    // Redis URL for caching (embeddings, semantic cache)
    redisUrl: process.env.REDIS_URL || "",
    // Use postgres if Redis not available
    usePostgres: process.env.CACHE_USE_POSTGRES === "true",
  },
};
