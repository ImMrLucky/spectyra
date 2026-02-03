#!/usr/bin/env node

/**
 * Spectyra Enterprise Proxy
 * 
 * Secure, enterprise-grade local proxy for routing OpenAI-compatible requests
 * through Spectyra's AI Gateway for cost optimization.
 * 
 * Features:
 * - OpenAI-compatible API endpoint
 * - Automatic path detection (talk vs code)
 * - Secure by default (127.0.0.1 binding, no key logging)
 * - Pass-through fallback mode
 * - Enterprise-ready configuration via env vars
 */

import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Package version (for client headers)
const PKG_VERSION = JSON.parse(
  readFileSync(path.join(__dirname, "./package.json"), "utf-8")
).version;

// ============================================================================
// Configuration from Environment Variables
// ============================================================================

const SPECTYRA_API_URL = process.env.SPECTYRA_API_URL || "https://spectyra.up.railway.app/v1";
const SPECTYRA_API_KEY = process.env.SPECTYRA_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const PROXY_PORT = parseInt(process.env.PROXY_PORT || "3001", 10);
const SPECTYRA_OPT_LEVEL = parseInt(process.env.SPECTYRA_OPT_LEVEL || "2", 10);
const SPECTYRA_RESPONSE_LEVEL = parseInt(process.env.SPECTYRA_RESPONSE_LEVEL || "2", 10);
const SPECTYRA_MODE = (process.env.SPECTYRA_MODE || "optimized") as "optimized" | "baseline";
const ALLOW_REMOTE_BIND = process.env.ALLOW_REMOTE_BIND === "true";
const DEBUG_LOG_PROMPTS = process.env.DEBUG_LOG_PROMPTS === "true";
const ENABLE_PASSTHROUGH = process.env.ENABLE_PASSTHROUGH === "true";

// Security: Allowed outbound domains
const ALLOWED_DOMAINS = [
  new URL(SPECTYRA_API_URL).hostname,
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.x.ai",
].filter(Boolean);

// ============================================================================
// Security Utilities
// ============================================================================

/**
 * Redact sensitive data from objects
 */
function redactSecrets(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }
  
  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("key") ||
      lowerKey.includes("token") ||
      lowerKey.includes("authorization") ||
      lowerKey.includes("api_key")
    ) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 20 && /^sk[-_][a-zA-Z0-9_-]+$/.test(value)) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = redactSecrets(value);
    }
  }
  return redacted;
}

/**
 * Safe logger that redacts secrets
 */
function safeLog(level: "info" | "warn" | "error", message: string, data?: any): void {
  if (!DEBUG_LOG_PROMPTS && data && data.messages) {
    data = { ...data, messages: "[REDACTED]" };
  }
  
  const redactedData = data ? redactSecrets(data) : undefined;
  
  if (level === "error") {
    console.error(`[${new Date().toISOString()}] ${message}`, redactedData || "");
  } else if (level === "warn") {
    console.warn(`[${new Date().toISOString()}] ${message}`, redactedData || "");
  } else {
    console.log(`[${new Date().toISOString()}] ${message}`, redactedData || "");
  }
}

/**
 * Check if domain is allowed for outbound requests
 */
function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_DOMAINS.some(allowed => hostname === allowed || hostname.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

// ============================================================================
// Path Detection (talk vs code)
// ============================================================================

/**
 * Auto-detect path (talk vs code) from messages
 */
function detectPath(messages: any[]): "talk" | "code" {
  if (!messages || messages.length === 0) {
    return "code"; // Default for coding tools
  }
  
  // Combine all message content
  const fullText = messages
    .map(m => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join(" ")
    .toLowerCase();
  
  // Code indicators
  const codeIndicators = [
    /```[\s\S]*?```/g, // Code blocks
    /function\s+\w+\s*\(/g,
    /class\s+\w+/g,
    /import\s+.*from/g,
    /const\s+\w+\s*=/g,
    /def\s+\w+\s*\(/g,
    /#include/g,
    /package\s+\w+/g,
    /public\s+class/g,
  ];
  
  const codeMatches = codeIndicators.reduce((count, pattern) => {
    const matches = fullText.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);
  
  // Talk indicators (conversational)
  const talkIndicators = [
    /\b(explain|describe|tell me|what is|how does|why)\b/g,
    /\b(question|answer|discuss|opinion|think|believe)\b/g,
  ];
  
  const talkMatches = talkIndicators.reduce((count, pattern) => {
    const matches = fullText.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);
  
  // If we have significant code indicators, it's code
  if (codeMatches >= 2) {
    return "code";
  }
  
  // If we have more talk indicators and no code, it's talk
  if (talkMatches > codeMatches && codeMatches === 0) {
    return "talk";
  }
  
  // Default to code for coding tools
  return "code";
}

// ============================================================================
// Message Format Conversion
// ============================================================================

/**
 * Convert messages from provider format to Spectyra format
 */
function convertMessagesToSpectyra(messages: any[], format: string): any[] {
  if (format === "anthropic") {
    return messages.map((m: any) => {
      let content = "";
      if (typeof m.content === "string") {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        const textPart = m.content.find((p: any) => p.type === "text");
        content = textPart?.text || "";
      }
      return {
        role: m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : "user",
        content,
      };
    });
  } else if (format === "gemini") {
    return messages.map((m: any) => {
      let content = "";
      if (m.parts && Array.isArray(m.parts)) {
        content = m.parts.map((p: any) => p.text || "").join("");
      } else if (typeof m.content === "string") {
        content = m.content;
      }
      return {
        role: m.role === "model" ? "assistant" : "user",
        content,
      };
    });
  } else {
    // OpenAI/Grok format
    return messages.map((m: any) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
  }
}

/**
 * Convert Spectyra response to provider format
 */
function convertResponseFromSpectyra(data: any, format: string, model: string): any {
  const responseText = data.response_text || data.responseText || "";
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;
  const totalTokens = data.usage?.total_tokens || 0;
  const id = data.id || `chatcmpl-${Date.now()}`;

  if (format === "anthropic") {
    return {
      id: `msg-${id}`,
      type: "message",
      role: "assistant",
      content: [{
        type: "text",
        text: responseText,
      }],
      model,
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
    };
  } else if (format === "gemini") {
    return {
      candidates: [{
        content: {
          parts: [{ text: responseText }],
          role: "model",
        },
        finishReason: "STOP",
        safetyRatings: [],
      }],
      usageMetadata: {
        promptTokenCount: inputTokens,
        candidatesTokenCount: outputTokens,
        totalTokenCount: totalTokens,
      },
    };
  } else {
    // OpenAI/Grok format
    return {
      id: `chatcmpl-${id}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: responseText,
        },
        finish_reason: "stop",
      }],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: totalTokens,
      },
    };
  }
}

// ============================================================================
// Provider Detection
// ============================================================================

/**
 * Detect provider from request
 */
function detectProvider(req: any, format: string): "openai" | "anthropic" | "gemini" | "grok" {
  // Check endpoint path
  if (req.path.includes("/v1/messages")) {
    return "anthropic";
  }
  if (req.path.includes("generativelanguage")) {
    return "gemini";
  }
  
  // Check model name
  const model = req.body?.model || "";
  if (model.includes("claude") || model.includes("anthropic")) {
    return "anthropic";
  }
  if (model.includes("gemini")) {
    return "gemini";
  }
  if (model.includes("grok")) {
    return "grok";
  }
  
  // Default based on format
  if (format === "anthropic") {
    return "anthropic";
  }
  if (format === "gemini") {
    return "gemini";
  }
  
  // Default to OpenAI
  return "openai";
}

/**
 * Get provider API key
 */
function getProviderKey(provider: string): string {
  switch (provider) {
    case "openai":
    case "grok":
      return OPENAI_API_KEY;
    case "anthropic":
      return ANTHROPIC_API_KEY;
    default:
      return "";
  }
}

// ============================================================================
// Pass-through Mode (Direct to Provider)
// ============================================================================

/**
 * Call provider directly (pass-through mode)
 */
async function callProviderDirect(
  provider: string,
  model: string,
  messages: any[],
  format: string
): Promise<any> {
  const providerKey = getProviderKey(provider);
  
  if (!providerKey) {
    throw new Error(`Provider key not configured for ${provider}`);
  }
  
  if (provider === "openai" || provider === "grok") {
    const apiUrl = provider === "grok" 
      ? "https://api.x.ai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${providerKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        })),
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Provider API error: ${response.status} ${error}`);
    }
    
    return await response.json();
  } else if (provider === "anthropic") {
    const systemMessage = messages.find(m => m.role === "system");
    const conversationMessages = messages.filter(m => m.role !== "system");
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": providerKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemMessage?.content,
        messages: conversationMessages.map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Provider API error: ${response.status} ${error}`);
    }
    
    return await response.json();
  }
  
  throw new Error(`Pass-through not supported for provider: ${provider}`);
}

// ============================================================================
// Main Request Handler
// ============================================================================

/**
 * Handle incoming request
 */
async function handleRequest(req: any, res: any, detectedFormat: string) {
  // Validate configuration
  if (!SPECTYRA_API_KEY) {
    return res.status(500).json({
      error: {
        message: "SPECTYRA_API_KEY environment variable is required",
        type: "configuration_error",
      },
    });
  }
  
  try {
    // Extract request data
    let model: string;
    let messages: any[];
    
    if (detectedFormat === "anthropic") {
      model = req.body.model || "claude-3-5-sonnet-20241022";
      messages = req.body.messages || [];
      if (req.body.system) {
        messages.unshift({ role: "system", content: req.body.system });
      }
    } else if (detectedFormat === "gemini") {
      model = req.body.model || "gemini-pro";
      const contents = req.body.contents || [];
      messages = contents.map((c: any) => ({
        role: c.role,
        parts: c.parts || [],
      }));
    } else {
      // OpenAI/Grok format
      model = req.body.model || "gpt-4o-mini";
      messages = req.body.messages || [];
    }
    
    // Detect provider
    const provider = detectProvider(req, detectedFormat);
    const providerKey = getProviderKey(provider);
    
    if (!providerKey && !ENABLE_PASSTHROUGH) {
      return res.status(500).json({
        error: {
          message: `Provider API key not configured. Set ${provider.toUpperCase()}_API_KEY environment variable.`,
          type: "configuration_error",
        },
      });
    }
    
    // Convert to Spectyra format
    const spectyraMessages = convertMessagesToSpectyra(messages, detectedFormat);
    
    // Auto-detect path
    const detectedPath = detectPath(spectyraMessages);
    
    // Try Spectyra API first
    let spectyraResponse: Response | null = null;
    let spectyraData: any = null;
    
    try {
      if (!isAllowedDomain(SPECTYRA_API_URL)) {
        throw new Error(`Domain not allowed: ${new URL(SPECTYRA_API_URL).hostname}`);
      }
      
      const spectyraUrl = `${SPECTYRA_API_URL}/chat`;
      spectyraResponse = await fetch(spectyraUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SPECTYRA-API-KEY": SPECTYRA_API_KEY,
          "X-PROVIDER-KEY": providerKey,
          "X-SPECTYRA-CLIENT": "spectyra-proxy",
          "X-SPECTYRA-CLIENT-VERSION": PKG_VERSION,
        },
        body: JSON.stringify({
          path: detectedPath,
          provider,
          model,
          messages: spectyraMessages,
          mode: SPECTYRA_MODE,
          optimization_level: SPECTYRA_OPT_LEVEL,
          response_optimization_level: SPECTYRA_RESPONSE_LEVEL,
        }),
      });
      
      if (spectyraResponse.ok) {
        spectyraData = await spectyraResponse.json();
      } else {
        // If Spectyra fails and passthrough is enabled, fall back
        if (ENABLE_PASSTHROUGH && providerKey) {
          safeLog("warn", "Spectyra API unavailable, using pass-through mode", {
            status: spectyraResponse.status,
          });
          throw new Error("Spectyra unavailable");
        }
        
        const errorText = await spectyraResponse.text();
        safeLog("error", "Spectyra API error", {
          status: spectyraResponse.status,
          error: errorText.substring(0, 200),
        });
        
        return res.status(spectyraResponse.status).json({
          error: {
            message: `Spectyra API error: ${spectyraResponse.statusText}`,
            type: "api_error",
          },
        });
      }
    } catch (error: any) {
      // If Spectyra fails and passthrough is enabled, use direct provider
      if (ENABLE_PASSTHROUGH && providerKey) {
        safeLog("warn", "Falling back to direct provider call", {
          error: error.message,
        });
        
        try {
          const directResponse = await callProviderDirect(provider, model, messages, detectedFormat);
          const providerResponse = convertResponseFromSpectyra(
            {
              response_text: directResponse.choices?.[0]?.message?.content || 
                            directResponse.content?.[0]?.text || 
                            "",
              usage: {
                input_tokens: directResponse.usage?.prompt_tokens || 
                             directResponse.usage?.input_tokens || 0,
                output_tokens: directResponse.usage?.completion_tokens || 
                              directResponse.usage?.output_tokens || 0,
                total_tokens: directResponse.usage?.total_tokens || 
                            (directResponse.usage?.input_tokens || 0) + 
                            (directResponse.usage?.output_tokens || 0),
              },
            },
            detectedFormat,
            model
          );
          return res.json(providerResponse);
        } catch (passthroughError: any) {
          safeLog("error", "Pass-through mode failed", {
            error: passthroughError.message,
          });
          return res.status(500).json({
            error: {
              message: "Both Spectyra and direct provider calls failed",
              type: "proxy_error",
            },
          });
        }
      }
      
      // No passthrough or passthrough failed
      safeLog("error", "Request failed", {
        error: error.message,
        headers: redactSecrets(req.headers),
      });
      
      return res.status(500).json({
        error: {
          message: error.message || "Internal proxy error",
          type: "proxy_error",
        },
      });
    }
    
    // Convert Spectyra response to provider format
    const providerResponse = convertResponseFromSpectyra(spectyraData, detectedFormat, model);
    res.json(providerResponse);
    
  } catch (error: any) {
    safeLog("error", "Proxy error", {
      error: error.message,
      stack: error.stack?.substring(0, 500),
    });
    
    res.status(500).json({
      error: {
        message: "Internal proxy error",
        type: "proxy_error",
      },
    });
  }
}

// ============================================================================
// Express App Setup
// ============================================================================

const app = express();

// Security: Only allow localhost by default
const bindHost = ALLOW_REMOTE_BIND ? "0.0.0.0" : "127.0.0.1";

// Middleware
app.use(cors());
app.use(express.json());

// Request logging (redacted)
app.use((req, res, next) => {
  if (DEBUG_LOG_PROMPTS) {
    safeLog("info", `${req.method} ${req.path}`, {
      headers: redactSecrets(req.headers),
      body: req.body,
    });
  }
  next();
});

// Endpoints
app.post("/v1/chat/completions", async (req, res) => {
  await handleRequest(req, res, "openai");
});

app.post("/v1/messages", async (req, res) => {
  await handleRequest(req, res, "anthropic");
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "spectyra-proxy",
    version: PKG_VERSION,
    configured: !!SPECTYRA_API_KEY,
  });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  safeLog("error", "Unhandled error", {
    error: err.message,
    path: req.path,
    headers: redactSecrets(req.headers),
  });
  
  res.status(500).json({
    error: {
      message: "Internal server error",
      type: "proxy_error",
    },
  });
});

// Start server
app.listen(PROXY_PORT, bindHost, () => {
  console.log(`\n🚀 Spectyra Enterprise Proxy v${PKG_VERSION}`);
  console.log(`   Listening on http://${bindHost}:${PROXY_PORT}`);
  console.log(`   Routing to: ${SPECTYRA_API_URL}`);
  
  if (!SPECTYRA_API_KEY) {
    console.log(`\n⚠️  Warning: SPECTYRA_API_KEY not set`);
  }
  
  if (ENABLE_PASSTHROUGH) {
    console.log(`   Pass-through mode: ENABLED`);
  }
  
  console.log(`\n💡 Configure your tool's API base URL:`);
  console.log(`   http://localhost:${PROXY_PORT}/v1\n`);
});
