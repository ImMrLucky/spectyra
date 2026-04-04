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
import { loadConfig, type CompanionConfig } from "./config.js";
import { type ChatMessage } from "./optimizer.js";
import { callProvider, isProviderKeyConfigured } from "./providers.js";
import { resolveAndOptimizeLocally } from "./inferencePipeline.js";
import { mapCompanionInferenceError } from "./httpErrors.js";
import {
  saveRun,
  savePromptComparison,
  getRuns,
  getPromptComparison,
  getSavingsSummary,
  companionEventsJsonlPath,
} from "./localStore.js";
import { readRecentNormalizedEventsJsonl } from "@spectyra/event-core/local-persistence";
import type { SpectyraEvent } from "@spectyra/event-core";
import { estimateInputCostUsd, estimateOutputCostUsd } from "@spectyra/analytics-core";
import {
  CompanionSessionRegistry,
  listStoredSessions,
  getStoredSessionById,
  readCurrentSessionForKey,
} from "./sessionAnalytics.js";
import {
  companionEventEngine,
  ingestCompanionChatCompleted,
  registerSseClient,
  getLiveStateFromEvents,
} from "./companionEvents.js";
import { summarizeExecutionGraphFromSpectyraEvents } from "@spectyra/execution-graph";
import {
  extractStateSnapshotsFromSpectyraEvents,
  summarizeStateDeltaFromSnapshots,
} from "@spectyra/state-delta";
import { evaluateWorkflowPolicyFromEvents } from "./workflowPolicyFromEvents.js";
import { activateLicense } from "@spectyra/optimization-engine";
import { recordOpenClawTrafficIfApplicable, getOpenClawIntegrationDiagnostics } from "./openclawTraffic.js";

const cfg: CompanionConfig = loadConfig();

function licenseSnapshot(): {
  licenseKeyPresent: boolean;
  /** True when a key is set and passes local activation (trial or paid). */
  licenseAllowsFullOptimization: boolean;
} {
  const key = cfg.licenseKey?.trim();
  if (!key) {
    return { licenseKeyPresent: false, licenseAllowsFullOptimization: false };
  }
  return { licenseKeyPresent: true, licenseAllowsFullOptimization: activateLicense(key) };
}

/** Upstream API key present for the configured provider (never exposes the key). */
function providerConfigured(): boolean {
  const p = cfg.provider;
  if (p !== "openai" && p !== "anthropic" && p !== "groq") return false;
  return isProviderKeyConfigured(p);
}
const sessionRegistry = new CompanionSessionRegistry(cfg);
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Health & Config ──────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  const lic = licenseSnapshot();
  const pc = providerConfigured();
  res.json({
    status: "ok",
    service: "spectyra-local-companion",
    runMode: cfg.runMode,
    workflowPolicyMode: cfg.workflowPolicyMode,
    telemetryMode: cfg.telemetryMode,
    promptSnapshots: cfg.promptSnapshots,
    persistNormalizedEvents: cfg.persistNormalizedEvents,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    licenseKeyPresent: lic.licenseKeyPresent,
    licenseAllowsFullOptimization: lic.licenseAllowsFullOptimization,
    /** True when telemetry is not off — normalized events + live analytics available. */
    monitoringEnabled: cfg.telemetryMode !== "off",
    provider: cfg.provider,
    providerConfigured: pc,
    /** Ready for inference: valid provider + local API key present. */
    companionReady: pc,
  });
});

app.get("/config", (_req, res) => {
  res.json({
    runMode: cfg.runMode,
    workflowPolicyMode: cfg.workflowPolicyMode,
    telemetryMode: cfg.telemetryMode,
    promptSnapshots: cfg.promptSnapshots,
    persistNormalizedEvents: cfg.persistNormalizedEvents,
    bindHost: cfg.bindHost,
    port: cfg.port,
    provider: cfg.provider,
    aliasSmartModel: cfg.aliasSmartModel,
    aliasFastModel: cfg.aliasFastModel,
    aliasQualityModel: cfg.aliasQualityModel,
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
      {
        id: "spectyra/quality",
        object: "model",
        created: now,
        owned_by: "spectyra-local",
      },
    ],
  });
});

// ── Integration diagnostics (safe metadata only; no secrets) ─────────────────

app.get("/v1/diagnostics/integration", (_req, res) => {
  const lic = licenseSnapshot();
  const pc = providerConfigured();
  res.json({
    spectyraLocalFirst: true,
    cloudPromptRelay: false,
    inferencePath: "direct_provider" as const,
    integrationSurface: "openai_and_anthropic_compatible",
    runMode: cfg.runMode,
    provider: cfg.provider,
    providerConfigured: pc,
    companionReady: pc,
    licenseKeyPresent: lic.licenseKeyPresent,
    licenseAllowsFullOptimization: lic.licenseAllowsFullOptimization,
    modelAliases: ["spectyra/smart", "spectyra/fast", "spectyra/quality"],
    endpoints: {
      openaiCompatible: "/v1/chat/completions",
      anthropicCompatible: "/v1/messages",
      models: "/v1/models",
    },
  });
});

/** Aggregated safe status for onboarding UIs (no secrets). */
app.get("/diagnostics/status", (_req, res) => {
  const lic = licenseSnapshot();
  const pc = providerConfigured();
  const desktopManaged = process.env.SPECTYRA_DESKTOP_MANAGED === "1";
  const accountSignedIn =
    process.env.SPECTYRA_ACCOUNT_SIGNED_IN === "1" ? true : process.env.SPECTYRA_ACCOUNT_SIGNED_IN === "0" ? false : undefined;
  const base = `http://${cfg.bindHost}:${cfg.port}`;
  res.json({
    desktopInstalled: desktopManaged,
    companionRunning: true,
    signedIn: accountSignedIn,
    providerConfigured: pc,
    providerType: cfg.provider,
    mode: cfg.runMode,
    companionBaseUrl: base,
    modelAliases: ["spectyra/smart", "spectyra/fast", "spectyra/quality"],
    licenseKeyPresent: lic.licenseKeyPresent,
    inferencePath: "direct_provider" as const,
  });
});

app.get("/diagnostics/integrations/openclaw", (_req, res) => {
  const o = getOpenClawIntegrationDiagnostics();
  const pc = providerConfigured();
  res.json({
    detected: o.detected,
    connected: o.connected && pc,
    configPresent: o.configPresent,
    lastSeenRequestAt: o.lastSeenRequestAt,
  });
});

// ── OpenAI-compatible endpoint ───────────────────────────────────────────────

app.post("/v1/chat/completions", async (req, res) => {
  recordOpenClawTrafficIfApplicable(req);
  try {
    const rawModel: string = req.body.model || "gpt-4o-mini";
    const messages: ChatMessage[] = (req.body.messages || []).map((m: any) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    const { resolved, optResult } = resolveAndOptimizeLocally(cfg, messages, rawModel);

    const policy = evaluateWorkflowPolicyFromEvents(companionEventEngine.snapshot(), cfg.workflowPolicyMode);
    if (policy.shouldBlock) {
      return res.status(422).json({
        error: {
          type: "workflow_policy_blocked",
          message: "Workflow policy blocked this request before the upstream provider call.",
          violations: policy.violations,
        },
      });
    }

    const providerResult = await callProvider(resolved.provider, resolved.upstreamModel, optResult.messages);

    const runId = crypto.randomUUID();
    const report = buildReport(runId, resolved.provider, resolved.upstreamModel, optResult, providerResult.usage);
    await persistLocally(runId, report, optResult, messages);
    const sk = sessionRegistry.sessionKeyFromRequest(req.headers as any);
    if (cfg.telemetryMode !== "off") {
      await sessionRegistry.recordStep(sk, report);
      const tr = sessionRegistry.getOrCreateTracker(sk);
      ingestCompanionChatCompleted({
        sessionId: tr.sessionId,
        runId: report.runId,
        report,
      });
    }

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
  } catch (err: unknown) {
    const mapped = mapCompanionInferenceError(err);
    res.status(mapped.status).json(mapped.body);
  }
});

// ── Anthropic-compatible endpoint ────────────────────────────────────────────

app.post("/v1/messages", async (req, res) => {
  recordOpenClawTrafficIfApplicable(req);
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

    const { resolved, optResult } = resolveAndOptimizeLocally(cfg, messages, rawModel);

    const policyMsg = evaluateWorkflowPolicyFromEvents(companionEventEngine.snapshot(), cfg.workflowPolicyMode);
    if (policyMsg.shouldBlock) {
      return res.status(422).json({
        error: {
          type: "workflow_policy_blocked",
          message: "Workflow policy blocked this request before the upstream provider call.",
          violations: policyMsg.violations,
        },
      });
    }

    const providerResult = await callProvider(resolved.provider, resolved.upstreamModel, optResult.messages);

    const runId = crypto.randomUUID();
    const report = buildReport(runId, resolved.provider, resolved.upstreamModel, optResult, providerResult.usage);
    await persistLocally(runId, report, optResult, messages);
    const sk = sessionRegistry.sessionKeyFromRequest(req.headers as any);
    if (cfg.telemetryMode !== "off") {
      await sessionRegistry.recordStep(sk, report);
      const tr = sessionRegistry.getOrCreateTracker(sk);
      ingestCompanionChatCompleted({
        sessionId: tr.sessionId,
        runId: report.runId,
        report,
      });
    }

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
  } catch (err: unknown) {
    const mapped = mapCompanionInferenceError(err);
    res.status(mapped.status).json(mapped.body);
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

// ── Unified analytics (workflow sessions, real-time snapshots) ─────────────

app.get("/v1/analytics/current-session", async (req, res) => {
  const sessionKey = (req.query.sessionKey as string) || "default";
  const live = sessionRegistry.getLiveSnapshot(sessionKey);
  if (live) return res.json(live);
  const disk = await readCurrentSessionForKey(sessionKey);
  res.json(disk);
});

app.get("/v1/analytics/sessions", async (req, res) => {
  const limit = parseInt(req.query.limit as string || "100", 10);
  res.json(await listStoredSessions(limit));
});

app.get("/v1/analytics/session/:sessionId", async (req, res) => {
  const row = await getStoredSessionById(req.params.sessionId);
  if (!row) return res.status(404).json({ error: "Session not found" });
  res.json(row);
});

app.get("/v1/analytics/prompt-comparison/:runId", async (req, res) => {
  const comparison = await getPromptComparison(req.params.runId);
  if (!comparison) return res.status(404).json({ error: "Not found" });
  res.json(comparison);
});

app.post("/v1/analytics/session/complete", async (req, res) => {
  const sessionKey = (req.body?.sessionKey as string) || sessionRegistry.sessionKeyFromRequest(req.headers as any);
  const rec = await sessionRegistry.completeSession(sessionKey);
  if (!rec) return res.status(404).json({ error: "No active session" });
  res.json(rec);
});

/** Optional: acknowledge sync intent (companion stays local-first; cloud upload is via Spectyra app/API). */
app.post("/v1/analytics/sync", (_req, res) => {
  res.json({ ok: true, message: "Analytics sync is configured in the Spectyra web/desktop app when signed in." });
});

/** Server-Sent Events: normalized SpectyraEvent stream (local-only). */
app.get("/v1/analytics/live-events", (req, res) => {
  registerSseClient(res);
});

/** Live state derived from normalized events (parallel to file-based current-session). */
app.get("/v1/analytics/live-state", (_req, res) => {
  res.json(getLiveStateFromEvents());
});

/** Execution graph + step usefulness from in-memory normalized event buffer (Phase 3). */
app.get("/v1/analytics/execution-graph/summary", (_req, res) => {
  if (cfg.telemetryMode === "off") {
    return res.status(403).json({ error: "telemetry_disabled" });
  }
  const events = companionEventEngine.snapshot();
  res.json(summarizeExecutionGraphFromSpectyraEvents(events));
});

/** State / delta analytics from the same in-memory buffer (Phase 4). */
app.get("/v1/analytics/state-delta/summary", (_req, res) => {
  if (cfg.telemetryMode === "off") {
    return res.status(403).json({ error: "telemetry_disabled" });
  }
  const events = companionEventEngine.snapshot();
  const snapshots = extractStateSnapshotsFromSpectyraEvents(events);
  const summary = summarizeStateDeltaFromSnapshots(snapshots);
  res.json(summary);
});

/** Workflow policy evaluation (same mode as inference: enforce may block provider; observe never). */
app.get("/v1/analytics/workflow-policy/summary", (_req, res) => {
  if (cfg.telemetryMode === "off") {
    return res.status(403).json({ error: "telemetry_disabled" });
  }
  const events = companionEventEngine.snapshot();
  res.json(evaluateWorkflowPolicyFromEvents(events, cfg.workflowPolicyMode));
});

/** Recent normalized events from disk (JSONL), newest last — for debugging / proof UI. */
app.get("/v1/analytics/events/recent", async (req, res) => {
  if (cfg.telemetryMode === "off") {
    return res.status(403).json({ error: "telemetry_disabled" });
  }
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const events = await readRecentNormalizedEventsJsonl(companionEventsJsonlPath(), limit);
  res.json({ events, path: companionEventsJsonlPath() } satisfies { events: SpectyraEvent[]; path: string });
});

/**
 * Push adapter-shaped JSON into the same normalization pipeline as in-process integrations.
 * Use for log tailers, sidecars, or daemons that cannot patch Claude / agent harnesses directly.
 */
app.post("/v1/analytics/ingest", (req, res) => {
  if (cfg.telemetryMode === "off") {
    return res.status(403).json({ error: "telemetry_disabled", message: "Set telemetry to local or enable in config." });
  }
  const body = req.body;
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "expected_json_object" });
  }
  const events = companionEventEngine.ingest(body);
  if (events.length === 0) {
    return res.status(422).json({
      error: "no_adapter_matched",
      hint:
        "Send a known envelope (e.g. kind: spectyra.companion.v1, spectyra.sdk.v1, spectyra.openclaw.jsonl.v1, or generic JSONL mapping).",
    });
  }
  res.json({ ok: true, count: events.length });
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
  const costInBefore = estimateInputCostUsd(opt.inputTokensBefore, model);
  const costInAfter = estimateInputCostUsd(opt.inputTokensAfter, model);
  const costOut = estimateOutputCostUsd(usage.outputTokens, model);
  const costBefore = costInBefore + costOut;
  const costAfter = costInAfter + costOut;
  const estSavings = Math.max(0, costBefore - costAfter);
  return {
    runId,
    mode: cfg.runMode,
    integrationType: "local-companion",
    provider,
    model,
    inputTokensBefore: opt.inputTokensBefore,
    inputTokensAfter: opt.inputTokensAfter,
    outputTokens: usage.outputTokens,
    estimatedCostBefore: costBefore,
    estimatedCostAfter: costAfter,
    estimatedSavings: estSavings,
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

const server = app.listen(cfg.port, cfg.bindHost, () => {
  console.log(`\nSpectyra Local Companion`);
  console.log(`  Listening: http://${cfg.bindHost}:${cfg.port}`);
  console.log(`  Run mode:  ${cfg.runMode}`);
  console.log(`  Telemetry: ${cfg.telemetryMode}`);
  console.log(`  Snapshots: ${cfg.promptSnapshots}`);
  console.log(`  Inference: direct to provider (no Spectyra cloud relay)`);
  console.log(`  Billing:   customer account`);
  console.log(`\nSet your LLM app's API base URL to: http://localhost:${cfg.port}/v1\n`);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  console.error(
    `[spectyra-companion] Cannot bind ${cfg.bindHost}:${cfg.port} — ${err.code ?? "ERR"}: ${err.message}. ` +
      `Quit any other Local Companion or dev server using this port.`,
  );
  process.exit(1);
});
