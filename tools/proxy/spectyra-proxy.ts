#!/usr/bin/env node

/**
 * Spectyra Local Proxy
 * 
 * Provides an OpenAI-compatible endpoint that routes requests through Spectyra's optimizer.
 * This allows tools like Claude Code and Copilot to use Spectyra via a local proxy.
 */

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PROXY_PORT || 3001;
const SPECTYRA_API = process.env.SPECTYRA_API_URL || "http://localhost:8080";

app.use(cors());
app.use(express.json());

// OpenAI-compatible chat completions endpoint
app.post("/v1/chat/completions", async (req, res) => {
  try {
    // Forward to Spectyra API with optimized mode
    const response = await fetch(`${SPECTYRA_API}/v1/chat?mode=optimized`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "code", // Default to code path for proxy
        provider: "openai", // Can be configured
        model: req.body.model || "gpt-4o-mini",
        messages: req.body.messages || [],
      }),
    });

    const data = await response.json();

    // Convert Spectyra response to OpenAI format
    res.json({
      id: `chatcmpl-${data.id}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: req.body.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: data.responseText,
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.total_tokens,
      },
    });
  } catch (error: any) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "spectyra-proxy" });
});

app.listen(PORT, () => {
  console.log(`Spectyra Proxy running on http://localhost:${PORT}`);
  console.log(`Routing requests to ${SPECTYRA_API}`);
  console.log(`\nTo use with OpenAI-compatible tools, set:`);
  console.log(`OPENAI_API_BASE=http://localhost:${PORT}/v1`);
});
