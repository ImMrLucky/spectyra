#!/usr/bin/env node

/**
 * Spectyra Local Proxy
 * 
 * Provides an OpenAI-compatible endpoint that routes requests through Spectyra's optimizer.
 * This allows tools like Claude Code, Copilot, and Cursor to use Spectyra via a local proxy.
 * 
 * Features:
 * - OpenAI-compatible API endpoint
 * - Automatic optimization via Spectyra
 * - Real-time savings tracking
 * - Web dashboard for monitoring
 * - Configuration management
 */

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = parseInt(process.env.PROXY_PORT || "3001", 10);
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || "3002", 10);
const SPECTYRA_API = process.env.SPECTYRA_API_URL || "https://spectyra.up.railway.app/v1";
const CONFIG_FILE = path.join(__dirname, ".spectyra-proxy-config.json");

// Load configuration
interface ProxyConfig {
  spectyraKey: string;
  providerKey: string;
  provider: "openai" | "anthropic" | "gemini" | "grok";
  path: "code" | "talk";
  optimizationLevel: number;
}

function loadConfig(): ProxyConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading config:", error);
  }
  return null;
}

function saveConfig(config: ProxyConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Error saving config:", error);
  }
}

// Stats tracking
interface RequestStats {
  totalRequests: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  requests: Array<{
    timestamp: number;
    tokensSaved: number;
    costSaved: number;
    pctSaved: number;
    model: string;
  }>;
}

const stats: RequestStats = {
  totalRequests: 0,
  totalTokensSaved: 0,
  totalCostSaved: 0,
  requests: [],
};

function addStats(savings: any, model: string): void {
  stats.totalRequests++;
  if (savings) {
    stats.totalTokensSaved += savings.tokens_saved || 0;
    stats.totalCostSaved += savings.cost_saved_usd || 0;
    stats.requests.push({
      timestamp: Date.now(),
      tokensSaved: savings.tokens_saved || 0,
      costSaved: savings.cost_saved_usd || 0,
      pctSaved: savings.pct_saved || 0,
      model,
    });
    // Keep only last 1000 requests
    if (stats.requests.length > 1000) {
      stats.requests = stats.requests.slice(-1000);
    }
  }
}

// Main proxy app
const app = express();
app.use(cors());
app.use(express.json());

// Convert messages from different formats to Spectyra format
function convertMessagesToSpectyra(messages: any[], format: string): any[] {
  if (format === "anthropic") {
    // Anthropic format: { role, content: string | array }
    return messages.map((m: any) => {
      let content = "";
      if (typeof m.content === "string") {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        const textPart = m.content.find((p: any) => p.type === "text");
        content = textPart?.text || "";
      }
      return {
        role: m.role === "assistant" ? "assistant" : "user",
        content,
      };
    });
  } else if (format === "gemini") {
    // Gemini format: { role, parts: [{ text }] }
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
    // OpenAI/Grok format: { role, content: string }
    return messages.map((m: any) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
  }
}

// Convert Spectyra response to provider format
function convertResponseFromSpectyra(data: any, format: string, model: string): any {
  const responseText = data.response_text || data.responseText || "";
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;
  const totalTokens = data.usage?.total_tokens || 0;
  const id = data.id || Date.now();

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
          parts: [{
            text: responseText,
          }],
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

// Detect API format from request
function detectApiFormat(req: any): string {
  const path = req.path;
  const body = req.body;
  
  // Check endpoint
  if (path.includes("/v1/messages")) {
    return "anthropic";
  }
  if (path.includes("/v1/models") || path.includes("generativelanguage")) {
    return "gemini";
  }
  if (path.includes("/v1/chat/completions")) {
    // Could be OpenAI or Grok - check body structure
    if (body.messages && Array.isArray(body.messages)) {
      // Check if messages have Anthropic-style content arrays
      if (body.messages.some((m: any) => Array.isArray(m.content))) {
        return "anthropic";
      }
      return "openai"; // Default to OpenAI
    }
  }
  
  // Default to OpenAI format
  return "openai";
}

// OpenAI-compatible chat completions endpoint
app.post("/v1/chat/completions", async (req, res) => {
  await handleRequest(req, res, "openai");
});

// Anthropic-compatible messages endpoint
app.post("/v1/messages", async (req, res) => {
  await handleRequest(req, res, "anthropic");
});

// Gemini-compatible endpoint (if needed)
app.post("/v1/*/generateContent", async (req, res) => {
  await handleRequest(req, res, "gemini");
});

// Generic handler for all formats
async function handleRequest(req: any, res: any, detectedFormat: string) {
  const config = loadConfig();
  
  if (!config || !config.spectyraKey || !config.providerKey) {
    return res.status(500).json({
      error: {
        message: "Proxy not configured. Please configure API keys first.",
        type: "configuration_error",
      },
    });
  }

  try {
    // Use configured provider or detect from request
    const provider = config.provider || (detectedFormat === "anthropic" ? "anthropic" : detectedFormat === "gemini" ? "gemini" : "openai");
    const format = detectedFormat;
    
    // Extract model and messages based on format
    let model: string;
    let messages: any[];
    
    if (format === "anthropic") {
      model = req.body.model || "claude-3-5-sonnet-20241022";
      messages = req.body.messages || [];
      // Handle system message separately for Anthropic
      if (req.body.system) {
        messages.unshift({ role: "system", content: req.body.system });
      }
    } else if (format === "gemini") {
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
    
    // Convert to Spectyra format
    const spectyraMessages = convertMessagesToSpectyra(messages, format);
    
    // Forward to Spectyra API
    const response = await fetch(`${SPECTYRA_API}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SPECTYRA-KEY": config.spectyraKey,
        "X-PROVIDER-KEY": config.providerKey,
      },
      body: JSON.stringify({
        path: config.path || "code",
        provider,
        model,
        messages: spectyraMessages,
        mode: "optimized",
        optimization_level: config.optimizationLevel || 2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Spectyra API error:", response.status, errorText);
      return res.status(response.status).json({
        error: {
          message: `Spectyra API error: ${response.statusText}`,
          type: "api_error",
        },
      });
    }

    const data = await response.json();
    
    // Track savings
    if (data.savings) {
      addStats(data.savings, model);
      console.log(`💰 Saved ${data.savings.pct_saved?.toFixed(1)}% (${data.savings.tokens_saved} tokens, $${data.savings.cost_saved_usd?.toFixed(4)})`);
    }

    // Convert Spectyra response back to provider format
    const providerResponse = convertResponseFromSpectyra(data, format, model);
    res.json(providerResponse);
  } catch (error: any) {
    console.error("Proxy error:", error);
    res.status(500).json({
      error: {
        message: error.message || "Internal proxy error",
        type: "proxy_error",
      },
    });
  }
}

// Configuration endpoint
app.post("/config", (req, res) => {
  try {
    const config: ProxyConfig = {
      spectyraKey: req.body.spectyraKey || "",
      providerKey: req.body.providerKey || "",
      provider: req.body.provider || "openai",
      path: req.body.path || "code",
      optimizationLevel: req.body.optimizationLevel || 2,
    };
    saveConfig(config);
    res.json({ success: true, message: "Configuration saved" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/config", (req, res) => {
  const config = loadConfig();
  if (!config) {
    return res.json({ configured: false });
  }
  // Don't send keys in response
  res.json({
    configured: true,
    provider: config.provider,
    path: config.path,
    optimizationLevel: config.optimizationLevel,
  });
});

// Stats endpoint
app.get("/stats", (req, res) => {
  res.json({
    totalRequests: stats.totalRequests,
    totalTokensSaved: stats.totalTokensSaved,
    totalCostSaved: stats.totalCostSaved,
    recentRequests: stats.requests.slice(-50), // Last 50 requests
  });
});

// Health check
app.get("/health", (req, res) => {
  const config = loadConfig();
  res.json({
    status: "ok",
    service: "spectyra-proxy",
    configured: !!config && !!config.spectyraKey && !!config.providerKey,
  });
});

// Start proxy server
app.listen(PORT, () => {
  console.log(`\n🚀 Spectyra Proxy running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${DASHBOARD_PORT}`);
  console.log(`🔗 Routing to: ${SPECTYRA_API}`);
  
  const config = loadConfig();
  if (!config || !config.spectyraKey || !config.providerKey) {
    console.log(`\n⚠️  Proxy not configured!`);
    console.log(`   Visit http://localhost:${DASHBOARD_PORT} to configure`);
  } else {
    console.log(`✅ Proxy configured (${config.provider}, ${config.path} path)`);
  }
  
  console.log(`\n💡 To use with OpenAI-compatible tools, set:`);
  console.log(`   OPENAI_API_BASE=http://localhost:${PORT}/v1\n`);
});

// Dashboard app (separate port)
const dashboard = express();
dashboard.use(cors());
dashboard.use(express.json());
dashboard.use(express.static(path.join(__dirname, "dashboard")));

// Dashboard API endpoints
dashboard.get("/api/config", (req, res) => {
  const config = loadConfig();
  res.json(config || {});
});

dashboard.post("/api/config", (req, res) => {
  try {
    const config: ProxyConfig = {
      spectyraKey: req.body.spectyraKey || "",
      providerKey: req.body.providerKey || "",
      provider: req.body.provider || "openai",
      path: req.body.path || "code",
      optimizationLevel: req.body.optimizationLevel || 2,
    };
    saveConfig(config);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

dashboard.get("/api/stats", (req, res) => {
  res.json({
    totalRequests: stats.totalRequests,
    totalTokensSaved: stats.totalTokensSaved,
    totalCostSaved: stats.totalCostSaved,
    recentRequests: stats.requests.slice(-100), // Last 100 for dashboard
  });
});

// Serve dashboard HTML
dashboard.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard", "index.html"));
});

dashboard.listen(DASHBOARD_PORT, () => {
  console.log(`📊 Dashboard running on http://localhost:${DASHBOARD_PORT}`);
});
