#!/usr/bin/env node

/**
 * Spectyra Local Companion
 *
 * Local-first LLM optimization runtime.
 *
 * - Runs on the customer machine (127.0.0.1 by default)
 * - Accepts OpenAI-compatible and Anthropic-compatible requests
 * - Optimizes prompts locally in off / observe / on mode
 * - Calls the provider DIRECTLY using the customer's own key
 * - Stores analytics locally — no cloud relay for inference
 * - Designed for OpenClaw, Cursor, Copilot, and other LLM tools
 */

import express from "express";
import cors from "cors";
import crypto from "crypto";
import type { SavingsReport, PromptComparison } from "@spectyra/core-types";
import { resolveSpectyraModel } from "@spectyra/shared";
import { loadConfig, type CompanionConfig } from "./config.js";
import { optimize, type ChatMessage } from "./optimizer.js";
import { callProvider } from "./providers.js";
import { saveRun, savePromptComparison, getRuns, getPromptComparison, getSavingsSummary } from "./localStore.js";

const cfg: CompanionConfig = loadConfig();
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Health & Config ──────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "spectyra-local-companion",
    runMode: cfg.runMode,
    telemetryMode: cfg.telemetryMode,
    promptSnapshots: cfg.promptSnapshots,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
  });
});

app.get("/config", (_req, res) => {
  res.json({
    runMode: cfg.runMode,
    telemetryMode: cfg.telemetryMode,
    promptSnapshots: cfg.promptSnapshots,
    bindHost: cfg.bindHost,
    port: cfg.port,
    provider: cfg.provider,
    aliasSmartModel: cfg.aliasSmartModel,
    aliasFastModel: cfg.aliasFastModel,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    cloudRelay: "none",
  });
});

// ── OpenAI-compatible models list (OpenClaw / Cursor / etc.) ─────────────────

app.get("/v1/models", (_req, res) => {
  const now = Math.floor(Date.now() / 1000);
  res.json({
    object: "list",
    data: [
      {
        id: "spectyra/smart",
        object: "model",
        created: now,
        owned_by: "spectyra-local",
      },
      {
        id: "spectyra/fast",
        object: "model",
        created: now,
        owned_by: "spectyra-local",
      },
    ],
  });
});

// ── OpenAI-compatible endpoint ───────────────────────────────────────────────

app.post("/v1/chat/completions", async (req, res) => {
  try {
    const rawModel: string = req.body.model || "gpt-4o-mini";
    const messages: ChatMessage[] = (req.body.messages || []).map((m: any) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    const resolved = resolveSpectyraModel(rawModel, {
      provider: cfg.provider,
      aliasSmartModel: cfg.aliasSmartModel,
      aliasFastModel: cfg.aliasFastModel,
    });
    const optResult = optimize(messages, cfg.runMode, cfg.licenseKey);

    const providerResult = await callProvider(resolved.provider, resolved.upstreamModel, optResult.messages);

    const runId = crypto.randomUUID();
    const report = buildReport(runId, resolved.provider, resolved.upstreamModel, optResult, providerResult.usage);
    await persistLocally(runId, report, optResult, messages);

    res.json({
      id: `chatcmpl-${runId}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: resolved.requestedModel,
      choices: [{
        index: 0,
        message: { role: "assistant", content: providerResult.text },
        finish_reason: "stop",
      }],
      usage: {
        prompt_tokens: providerResult.usage.inputTokens,
        completion_tokens: providerResult.usage.outputTokens,
        total_tokens: providerResult.usage.inputTokens + providerResult.usage.outputTokens,
      },
      spectyra: {
        runId,
        mode: cfg.runMode,
        inputTokensBefore: optResult.inputTokensBefore,
        inputTokensAfter: optResult.inputTokensAfter,
        tokensSaved: Math.max(0, optResult.inputTokensBefore - optResult.inputTokensAfter),
        transforms: optResult.transforms,
        inferencePath: "direct_provider",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message, type: "companion_error" } });
  }
});

// ── Anthropic-compatible endpoint ────────────────────────────────────────────

app.post("/v1/messages", async (req, res) => {
  try {
    const rawModel: string = req.body.model || "claude-3-5-sonnet-latest";
    const messages: ChatMessage[] = [];
    if (req.body.system) messages.push({ role: "system", content: req.body.system });
    for (const m of req.body.messages || []) {
      messages.push({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      });
    }

    const resolved = resolveSpectyraModel(rawModel, {
      provider: cfg.provider,
      aliasSmartModel: cfg.aliasSmartModel,
      aliasFastModel: cfg.aliasFastModel,
    });
    const optResult = optimize(messages, cfg.runMode, cfg.licenseKey);
    const providerResult = await callProvider(resolved.provider, resolved.upstreamModel, optResult.messages);

    const runId = crypto.randomUUID();
    const report = buildReport(runId, resolved.provider, resolved.upstreamModel, optResult, providerResult.usage);
    await persistLocally(runId, report, optResult, messages);

    res.json({
      id: `msg-${runId}`,
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: providerResult.text }],
      model: resolved.requestedModel,
      stop_reason: "end_turn",
      usage: {
        input_tokens: providerResult.usage.inputTokens,
        output_tokens: providerResult.usage.outputTokens,
      },
      spectyra: {
        runId,
        mode: cfg.runMode,
        tokensSaved: Math.max(0, optResult.inputTokensBefore - optResult.inputTokensAfter),
        inferencePath: "direct_provider",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message, type: "companion_error" } });
  }
});

// ── Local analytics endpoints ────────────────────────────────────────────────

app.get("/v1/runs/current", async (_req, res) => {
  const runs = await getRuns(1);
  res.json(runs[0] || null);
});

app.get("/v1/runs", async (req, res) => {
  const limit = parseInt(req.query.limit as string || "50", 10);
  res.json(await getRuns(limit));
});

app.get("/v1/savings/summary", async (_req, res) => {
  res.json(await getSavingsSummary());
});

app.get("/v1/prompt-comparison/:runId", async (req, res) => {
  const comparison = await getPromptComparison(req.params.runId);
  if (!comparison) return res.status(404).json({ error: "Not found" });
  res.json(comparison);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildReport(
  runId: string,
  provider: string,
  model: string,
  opt: { inputTokensBefore: number; inputTokensAfter: number; transforms: string[] },
  usage: { inputTokens: number; outputTokens: number },
): SavingsReport {
  const saved = opt.inputTokensBefore - opt.inputTokensAfter;
  const pct = opt.inputTokensBefore > 0 ? (saved / opt.inputTokensBefore) * 100 : 0;
  return {
    runId,
    mode: cfg.runMode,
    integrationType: "local-companion",
    provider,
    model,
    inputTokensBefore: opt.inputTokensBefore,
    inputTokensAfter: opt.inputTokensAfter,
    outputTokens: usage.outputTokens,
    estimatedCostBefore: 0,
    estimatedCostAfter: 0,
    estimatedSavings: 0,
    estimatedSavingsPct: pct,
    contextReductionPct: pct > 0 ? pct : undefined,
    telemetryMode: cfg.telemetryMode,
    promptSnapshotMode: cfg.promptSnapshots,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    transformsApplied: opt.transforms,
    success: true,
    createdAt: new Date().toISOString(),
  };
}

async function persistLocally(
  runId: string,
  report: SavingsReport,
  opt: { inputTokensBefore: number; inputTokensAfter: number; transforms: string[]; messages: ChatMessage[] },
  originalMessages: ChatMessage[],
): Promise<void> {
  if (cfg.telemetryMode !== "off") {
    await saveRun(report).catch(() => {});
  }
  if (cfg.promptSnapshots === "local_only") {
    const comparison: PromptComparison = {
      originalMessagesSummary: originalMessages.map((m) => ({ role: m.role, len: m.content.length })),
      optimizedMessagesSummary: opt.messages.map((m) => ({ role: m.role, len: m.content.length })),
      diffSummary: {
        inputTokensBefore: opt.inputTokensBefore,
        inputTokensAfter: opt.inputTokensAfter,
        tokensSaved: Math.max(0, opt.inputTokensBefore - opt.inputTokensAfter),
        pctSaved: opt.inputTokensBefore > 0 ? ((opt.inputTokensBefore - opt.inputTokensAfter) / opt.inputTokensBefore) * 100 : 0,
        transformsApplied: opt.transforms,
      },
      storageMode: "local_only",
      localOnly: true,
    };
    await savePromptComparison(runId, comparison).catch(() => {});
  }
}

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(cfg.port, cfg.bindHost, () => {
  console.log(`\nSpectyra Local Companion`);
  console.log(`  Listening: http://${cfg.bindHost}:${cfg.port}`);
  console.log(`  Run mode:  ${cfg.runMode}`);
  console.log(`  Telemetry: ${cfg.telemetryMode}`);
  console.log(`  Snapshots: ${cfg.promptSnapshots}`);
  console.log(`  Inference: direct to provider (no Spectyra cloud relay)`);
  console.log(`  Billing:   customer account`);
  console.log(`\nSet your LLM app's API base URL to: http://localhost:${cfg.port}/v1\n`);
});
