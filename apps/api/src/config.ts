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
  
  embeddings: {
    openaiModel: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
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
};
