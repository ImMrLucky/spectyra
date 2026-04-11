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

import express, { type Request, type Response } from "express";
import cors from "cors";
import crypto from "crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { openAiSseProxyTransform, type OpenAiStreamUsage } from "./sseOpenAiProxy.js";
import type { SavingsReport, PromptComparison } from "@spectyra/core-types";
import { loadConfig, type CompanionConfig } from "./config.js";
import { companionPackageVersion } from "./packageVersion.js";
import { type ChatMessage, type OptimizeResult } from "./optimizer.js";
import { deriveSavingsMetrics } from "./reportMetrics.js";
import {
  callProvider,
  forwardableOpenAiChatFields,
  isProviderKeyConfigured,
  openAiChatCompletionStreaming,
} from "./providers.js";
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
import { spectyraOpenClawModelDefinitions } from "@spectyra/shared";
import { recordOpenClawTrafficIfApplicable, getOpenClawIntegrationDiagnostics } from "./openclawTraffic.js";
import { dashboardPageHtml } from "./dashboardPageHtml.js";
import { resolveSpectyraCloudApiV1Base } from "./cloudDefaults.js";
import {
  loadDesktopConfig,
  getValidSupabaseAccessToken,
  ensureDesktopSessionRefreshed,
} from "./desktopSession.js";
import {
  refreshBillingEntitlement,
  getCachedBillingAllowsRealSavings,
} from "./billingEntitlement.js";

const cfg: CompanionConfig = loadConfig();

function cloudApiV1BaseUrl(): string {
  return resolveSpectyraCloudApiV1Base();
}

/**
 * Match CLI: prefer Supabase JWT for cloud calls when the session can be refreshed;
 * fall back to org API key (same as inference) for billing when no session.
 * Account-only routes must use JWT — use mode "sessionOnly".
 */
async function spectyraCloudAuthHeaders(
  mode: "billing" | "sessionOnly",
): Promise<{ ok: true; headers: Record<string, string> } | { ok: false; status: number; message: string }> {
  const token = await getValidSupabaseAccessToken(loadDesktopConfig());
  if (token) {
    return { ok: true, headers: { Authorization: `Bearer ${token}` } };
  }
  if (mode === "sessionOnly") {
    return {
      ok: false,
      status: 401,
      message:
        "Sign-in session expired or missing — run spectyra-companion setup and sign in again. Account actions need a browser session.",
    };
  }
  const snap = loadConfig();
  const key = snap.spectyraApiKey?.trim() || snap.licenseKey?.trim();
  if (!key) {
    return {
      ok: false,
      status: 503,
      message: "No Spectyra API key — run spectyra-companion setup.",
    };
  }
  return { ok: true, headers: { "X-SPECTYRA-API-KEY": key } };
}

/** Browser-safe return URL for Stripe after Checkout (localhost dashboard). */
function localDashboardOrigin(): string {
  const snap = loadConfig();
  const host = snap.bindHost === "0.0.0.0" ? "127.0.0.1" : snap.bindHost;
  return `http://${host}:${snap.port}`;
}

const SPECTYRA_MODEL_IDS = spectyraOpenClawModelDefinitions().map((d) => d.id);

function licenseSnapshot(): {
  licenseKeyPresent: boolean;
  /** True when a key is set, billing allows savings, and local activation passes. */
  licenseAllowsFullOptimization: boolean;
} {
  const c = loadConfig();
  const key = c.spectyraAccountLinked ? c.licenseKey?.trim() || c.spectyraApiKey : undefined;
  if (!key) {
    return { licenseKeyPresent: false, licenseAllowsFullOptimization: false };
  }
  const billingOk = getCachedBillingAllowsRealSavings() === true;
  return {
    licenseKeyPresent: true,
    licenseAllowsFullOptimization: billingOk && activateLicense(key),
  };
}

/** Upstream API key present for the configured provider (never exposes the key). */
function providerConfigured(): boolean {
  const c = loadConfig();
  const p = c.provider;
  if (p !== "openai" && p !== "anthropic" && p !== "groq") return false;
  return isProviderKeyConfigured(p);
}

/**
 * Only persist runs, sessions, events, prompt snapshots, and cloud sync when billing allows real optimization.
 * Unpaid / unlinked traffic still uses the companion as a router but must not mutate analytics or learning.
 */
function shouldRecordCompanionAnalytics(opt: OptimizeResult): boolean {
  return !opt.licenseLimited;
}

function parseMaxTokensOpenAiCompatible(body: Record<string, unknown>): number | undefined {
  const mt = body.max_tokens;
  const mc = body.max_completion_tokens;
  if (typeof mt === "number" && Number.isFinite(mt)) return mt;
  if (typeof mc === "number" && Number.isFinite(mc)) return mc;
  return undefined;
}
const sessionRegistry = new CompanionSessionRegistry(cfg);
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Local savings dashboard (OpenClaw / skill users — no Desktop required) ───

app.get("/", (_req, res) => {
  res.redirect(302, "/dashboard");
});

app.get("/dashboard", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(dashboardPageHtml());
});

/**
 * Returns credentials for clients that call Spectyra Cloud directly (CLI, tools). The dashboard uses
 * same-origin `/v1/billing/*` only and does not need this for billing.
 * Same-origin only; do not cache.
 */
app.get("/v1/session/billing-auth", async (_req, res) => {
  await ensureDesktopSessionRefreshed().catch(() => undefined);
  res.setHeader("Cache-Control", "no-store");
  const token = await getValidSupabaseAccessToken(loadDesktopConfig());
  if (token) {
    res.json({ scheme: "bearer", credential: token });
    return;
  }
  const snap = loadConfig();
  const key = snap.spectyraApiKey?.trim() || snap.licenseKey?.trim();
  if (!key) {
    res.status(401).json({ error: "No Spectyra session or API key" });
    return;
  }
  res.json({ scheme: "apikey", credential: key });
});

// ── Health & Config ──────────────────────────────────────────────────────────

app.get("/health", async (_req, res) => {
  await ensureDesktopSessionRefreshed().catch(() => undefined);
  await refreshBillingEntitlement();
  const lic = licenseSnapshot();
  const pc = providerConfigured();
  const snap = loadConfig();
  const billingAllows =
    snap.spectyraAccountLinked && getCachedBillingAllowsRealSavings() === true;
  res.json({
    status: "ok",
    service: "spectyra-local-companion",
    packageVersion: companionPackageVersion(),
    runMode: snap.runMode,
    optimizationRunMode: snap.optimizationRunMode,
    spectyraAccountLinked: snap.spectyraAccountLinked,
    accountEmail: snap.accountEmail ?? null,
    workflowPolicyMode: snap.workflowPolicyMode,
    telemetryMode: snap.telemetryMode,
    promptSnapshots: snap.promptSnapshots,
    persistNormalizedEvents: snap.persistNormalizedEvents,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    licenseKeyPresent: lic.licenseKeyPresent,
    licenseAllowsFullOptimization: lic.licenseAllowsFullOptimization,
    /** True when telemetry is not off — normalized events + live analytics available. */
    monitoringEnabled: snap.telemetryMode !== "off",
    /** Redacted session summaries can POST to Spectyra when signed in (see syncAnalyticsToCloud). */
    syncAnalyticsToCloud: snap.syncAnalyticsToCloud,
    provider: snap.provider,
    providerConfigured: pc,
    /** Which vendor API keys are present (multi-vendor `spectyra/<vendor>/…` routes). */
    providerKeysPresent: {
      openai: isProviderKeyConfigured("openai"),
      anthropic: isProviderKeyConfigured("anthropic"),
      groq: isProviderKeyConfigured("groq"),
    },
    /** Ready for inference: valid provider + local API key present. */
    companionReady: pc,
    /** Without this, real input optimization stays in preview (observe-style) until setup saves session + Spectyra API key. */
    savingsEnabled:
      snap.spectyraAccountLinked &&
      snap.optimizationRunMode === "on" &&
      snap.runMode === "on" &&
      billingAllows,
    /**
     * Linked org has active trial or paid access (Spectyra Cloud billing). When false and linked, only projected savings apply.
     */
    billingAllowsRealSavings: snap.spectyraAccountLinked ? billingAllows : null,
  });
});

app.get("/config", async (_req, res) => {
  await ensureDesktopSessionRefreshed().catch(() => undefined);
  const snap = loadConfig();
  res.json({
    runMode: snap.runMode,
    optimizationRunMode: snap.optimizationRunMode,
    spectyraAccountLinked: snap.spectyraAccountLinked,
    accountEmail: snap.accountEmail ?? null,
    workflowPolicyMode: snap.workflowPolicyMode,
    telemetryMode: snap.telemetryMode,
    promptSnapshots: snap.promptSnapshots,
    persistNormalizedEvents: snap.persistNormalizedEvents,
    bindHost: snap.bindHost,
    port: snap.port,
    provider: snap.provider,
    aliasSmartModel: snap.aliasSmartModel,
    aliasFastModel: snap.aliasFastModel,
    aliasQualityModel: snap.aliasQualityModel,
    providerTierModels: snap.providerTierModels ?? null,
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
  const snap = loadConfig();
  res.json({
    spectyraLocalFirst: true,
    cloudPromptRelay: false,
    inferencePath: "direct_provider" as const,
    integrationSurface: "openai_and_anthropic_compatible",
    runMode: snap.runMode,
    provider: snap.provider,
    providerConfigured: pc,
    companionReady: pc,
    licenseKeyPresent: lic.licenseKeyPresent,
    licenseAllowsFullOptimization: lic.licenseAllowsFullOptimization,
    modelAliases: SPECTYRA_MODEL_IDS,
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
  const snap = loadConfig();
  const desktopManaged = process.env.SPECTYRA_DESKTOP_MANAGED === "1";
  const accountSignedIn =
    process.env.SPECTYRA_ACCOUNT_SIGNED_IN === "1" ? true : process.env.SPECTYRA_ACCOUNT_SIGNED_IN === "0" ? false : undefined;
  const base = `http://${snap.bindHost}:${snap.port}`;
  res.json({
    desktopInstalled: desktopManaged,
    companionRunning: true,
    signedIn: accountSignedIn,
    providerConfigured: pc,
    providerType: snap.provider,
    mode: snap.runMode,
    companionBaseUrl: base,
    modelAliases: SPECTYRA_MODEL_IDS,
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

/**
 * Proxy Spectyra Cloud billing using the org API key from ~/.spectyra/desktop/config.json.
 * Lets the local dashboard and tools subscribe without opening the Spectyra web app.
 */
app.get("/v1/billing/status", async (_req, res) => {
  const auth = await spectyraCloudAuthHeaders("billing");
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  try {
    const r = await fetch(`${cloudApiV1BaseUrl()}/billing/status`, {
      headers: auth.headers,
    });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    res.status(r.status).json(body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cloud request failed";
    res.status(502).json({ error: msg });
  }
});

/**
 * GET redirects to the dashboard (checkout is POST-only). Register with and without trailing slash —
 * browsers often normalize URLs with a final `/`, which would otherwise 404.
 */
function redirectCheckoutGetToDashboard(_req: Request, res: Response): void {
  res.redirect(302, "/dashboard?checkout=use_post");
}
app.get(["/v1/billing/checkout", "/v1/billing/checkout/"], redirectCheckoutGetToDashboard);

app.post(["/v1/billing/checkout", "/v1/billing/checkout/"], async (req, res) => {
  const auth = await spectyraCloudAuthHeaders("billing");
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const origin = localDashboardOrigin();
  const rawBody =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  const success_url =
    typeof rawBody.success_url === "string" && rawBody.success_url.trim()
      ? rawBody.success_url.trim()
      : `${origin}/dashboard?upgraded=1`;
  const cancel_url =
    typeof rawBody.cancel_url === "string" && rawBody.cancel_url.trim()
      ? rawBody.cancel_url.trim()
      : `${origin}/dashboard`;
  try {
    const r = await fetch(`${cloudApiV1BaseUrl()}/billing/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...auth.headers,
      },
      body: JSON.stringify({
        success_url,
        cancel_url,
        // OpenClaw / local dashboard: single-seat subscription (org seat_limit may be higher for team web).
        checkout_quantity: 1,
      }),
    });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    res.status(r.status).json(body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cloud request failed";
    res.status(502).json({ error: msg });
  }
});

/** Proxy JWT-only account routes (cancel / pause / delete) for the local dashboard. */
app.get("/v1/account/summary", async (_req, res) => {
  const auth = await spectyraCloudAuthHeaders("sessionOnly");
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  try {
    const r = await fetch(`${cloudApiV1BaseUrl()}/account/summary`, { headers: auth.headers });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    res.status(r.status).json(body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cloud request failed";
    res.status(502).json({ error: msg });
  }
});

async function proxyAccountPost(path: string, req: Request, res: Response): Promise<void> {
  const auth = await spectyraCloudAuthHeaders("sessionOnly");
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  try {
    const r = await fetch(`${cloudApiV1BaseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth.headers },
      body: JSON.stringify(req.body && typeof req.body === "object" ? req.body : {}),
    });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    res.status(r.status).json(body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cloud request failed";
    res.status(502).json({ error: msg });
  }
}

app.post("/v1/account/subscription/cancel-at-period-end", (req, res) => {
  void proxyAccountPost("/account/subscription/cancel-at-period-end", req, res);
});
app.post("/v1/account/subscription/keep", (req, res) => {
  void proxyAccountPost("/account/subscription/keep", req, res);
});
app.post("/v1/account/pause-service", (req, res) => {
  void proxyAccountPost("/account/pause-service", req, res);
});
app.post("/v1/account/resume-service", (req, res) => {
  void proxyAccountPost("/account/resume-service", req, res);
});
app.post("/v1/account/delete", (req, res) => {
  void proxyAccountPost("/account/delete", req, res);
});

/**
 * Many clients (including OpenClaw chat) send `"stream": true` and only consume
 * `text/event-stream` chunks. Responding with `application/json` yields a 200
 * with an empty UI. Shape matches OpenAI streaming chat completions.
 */
function writeOpenAiChatCompletionStream(
  res: Response,
  params: {
    runId: string;
    model: string;
    content: string;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  },
): void {
  const { runId, model, content, usage } = params;
  const id = `chatcmpl-${runId}`;
  const created = Math.floor(Date.now() / 1000);
  const send = (obj: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  send({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
  });
  if (content.length > 0) {
    send({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta: { content }, finish_reason: null }],
    });
  }
  send({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    usage,
  });
  res.write("data: [DONE]\n\n");
  res.end();
}

// ── OpenAI-compatible endpoint ───────────────────────────────────────────────

function normalizeOpenAiCompatibleMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m: Record<string, unknown>) => {
    const role = String(m.role ?? "user");
    let content: string | null;
    if (m.content === null || m.content === undefined) {
      content = m.tool_calls != null && role === "assistant" ? null : "";
    } else if (typeof m.content === "string") {
      content = m.content;
    } else {
      content = JSON.stringify(m.content);
    }
    const msg: ChatMessage = { role, content };
    if (m.tool_calls != null) msg.tool_calls = m.tool_calls;
    if (m.tool_call_id != null) msg.tool_call_id = String(m.tool_call_id);
    if (m.name != null) msg.name = String(m.name);
    return msg;
  });
}

app.post("/v1/chat/completions", async (req, res) => {
  recordOpenClawTrafficIfApplicable(req);
  try {
    const icfg = loadConfig();
    const rawModel: string = req.body.model || "gpt-4o-mini";
    const messages = normalizeOpenAiCompatibleMessages(req.body.messages);

    const { resolved, optResult } = await resolveAndOptimizeLocally(icfg, messages, rawModel);

    const policy = evaluateWorkflowPolicyFromEvents(companionEventEngine.snapshot(), icfg.workflowPolicyMode);
    if (policy.shouldBlock) {
      return res.status(422).json({
        error: {
          type: "workflow_policy_blocked",
          message: "Workflow policy blocked this request before the upstream provider call.",
          violations: policy.violations,
        },
      });
    }

    const maxTokens = parseMaxTokensOpenAiCompatible((req.body || {}) as Record<string, unknown>);
    const openAiForward =
      resolved.provider === "openai" || resolved.provider === "groq"
        ? forwardableOpenAiChatFields((req.body || {}) as Record<string, unknown>)
        : undefined;

    const wantsStream = req.body?.stream === true || req.body?.stream === "true";

    /**
     * OpenClaw sends stream: true. We must proxy upstream SSE — synthetic streams from `.text` alone
     * break tool calls, reasoning, and several GPT-5 responses (empty `content`).
     */
    if (wantsStream && (resolved.provider === "openai" || resolved.provider === "groq")) {
      const runId = crypto.randomUUID();
      const upstream = await openAiChatCompletionStreaming(
        resolved.provider,
        resolved.upstreamModel,
        optResult.messages,
        maxTokens,
        openAiForward,
      );
      if (!upstream.ok) {
        throw new Error(`openai API error: ${upstream.status} ${await upstream.text()}`);
      }
      const ct = upstream.headers.get("content-type");
      if (ct) res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      if (!upstream.body) {
        res.end();
        return;
      }
      const webBody = upstream.body as import("stream/web").ReadableStream;
      const source = Readable.fromWeb(webBody);
      const usageBox: { last: OpenAiStreamUsage | null } = { last: null };
      const sseTransform = openAiSseProxyTransform({
        spectyraAlias: resolved.requestedModel.startsWith("spectyra/") ? resolved.requestedModel : null,
        onUsage: (u) => {
          usageBox.last = u;
        },
      });
      await pipeline(source, sseTransform, res);

      const cap = usageBox.last;
      const streamUsage = {
        inputTokens: cap?.prompt_tokens ?? optResult.inputTokensAfter,
        outputTokens: cap?.completion_tokens ?? 0,
      };
      if (shouldRecordCompanionAnalytics(optResult)) {
        const report = attachSessionToReport(
          buildReport(runId, resolved.provider, resolved.upstreamModel, optResult, streamUsage, icfg),
          req.headers as Record<string, string | string[] | undefined>,
        );
        await persistLocally(runId, report, optResult, messages, icfg);
        const sk = sessionRegistry.sessionKeyFromRequest(req.headers as any);
        if (icfg.telemetryMode !== "off") {
          await sessionRegistry.recordStep(sk, report);
          const tr = sessionRegistry.getOrCreateTracker(sk);
          ingestCompanionChatCompleted({
            sessionId: tr.sessionId,
            runId: report.runId,
            report,
          });
        }
      }
      return;
    }

    const providerResult = await callProvider(
      resolved.provider,
      resolved.upstreamModel,
      optResult.messages,
      maxTokens,
      openAiForward,
    );

    const runId = crypto.randomUUID();
    if (shouldRecordCompanionAnalytics(optResult)) {
      const report = attachSessionToReport(
        buildReport(
          runId,
          resolved.provider,
          resolved.upstreamModel,
          optResult,
          providerResult.usage,
          icfg,
        ),
        req.headers as Record<string, string | string[] | undefined>,
      );
      await persistLocally(runId, report, optResult, messages, icfg);
      const sk = sessionRegistry.sessionKeyFromRequest(req.headers as any);
      if (icfg.telemetryMode !== "off") {
        await sessionRegistry.recordStep(sk, report);
        const tr = sessionRegistry.getOrCreateTracker(sk);
        ingestCompanionChatCompleted({
          sessionId: tr.sessionId,
          runId: report.runId,
          report,
        });
      }
    }

    const usage = {
      prompt_tokens: providerResult.usage.inputTokens,
      completion_tokens: providerResult.usage.outputTokens,
      total_tokens: providerResult.usage.inputTokens + providerResult.usage.outputTokens,
    };

    if (wantsStream) {
      writeOpenAiChatCompletionStream(res, {
        runId,
        model: resolved.requestedModel,
        content: providerResult.text,
        usage,
      });
      return;
    }

    const assistantMessage =
      providerResult.openAiAssistantMessage && Object.keys(providerResult.openAiAssistantMessage).length > 0
        ? providerResult.openAiAssistantMessage
        : { role: "assistant" as const, content: providerResult.text };

    res.json({
      id: `chatcmpl-${runId}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: resolved.requestedModel,
      choices: [{
        index: 0,
        message: assistantMessage,
        finish_reason: providerResult.finishReason ?? "stop",
      }],
      usage,
      spectyra: {
        runId,
        mode: icfg.optimizationRunMode,
        inputTokensBefore: optResult.inputTokensBefore,
        inputTokensAfter: optResult.inputTokensAfter,
        tokensSaved: Math.max(0, optResult.inputTokensBefore - optResult.inputTokensAfter),
        transforms: optResult.transforms,
        inferencePath: "direct_provider",
        analyticsRecorded: !optResult.licenseLimited,
      },
    });
  } catch (err: unknown) {
    if (res.headersSent) {
      return;
    }
    const mapped = mapCompanionInferenceError(err);
    res.status(mapped.status).json(mapped.body);
  }
});

// ── Anthropic-compatible endpoint ────────────────────────────────────────────

app.post("/v1/messages", async (req, res) => {
  try {
    const icfg = loadConfig();
    const rawModel: string = req.body.model || "claude-3-5-sonnet-latest";
    const messages: ChatMessage[] = [];
    if (req.body.system) messages.push({ role: "system", content: req.body.system });
    for (const m of req.body.messages || []) {
      messages.push({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      });
    }

    const { resolved, optResult } = await resolveAndOptimizeLocally(icfg, messages, rawModel);

    if (shouldRecordCompanionAnalytics(optResult)) {
      recordOpenClawTrafficIfApplicable(req);
    }

    const policyMsg = evaluateWorkflowPolicyFromEvents(companionEventEngine.snapshot(), icfg.workflowPolicyMode);
    if (policyMsg.shouldBlock) {
      return res.status(422).json({
        error: {
          type: "workflow_policy_blocked",
          message: "Workflow policy blocked this request before the upstream provider call.",
          violations: policyMsg.violations,
        },
      });
    }

    const maxTok =
      typeof req.body.max_tokens === "number" && Number.isFinite(req.body.max_tokens)
        ? req.body.max_tokens
        : undefined;
    const providerResult = await callProvider(
      resolved.provider,
      resolved.upstreamModel,
      optResult.messages,
      maxTok,
    );

    const runId = crypto.randomUUID();
    if (shouldRecordCompanionAnalytics(optResult)) {
      const report = attachSessionToReport(
        buildReport(
          runId,
          resolved.provider,
          resolved.upstreamModel,
          optResult,
          providerResult.usage,
          icfg,
        ),
        req.headers as Record<string, string | string[] | undefined>,
      );
      await persistLocally(runId, report, optResult, messages, icfg);
      const sk = sessionRegistry.sessionKeyFromRequest(req.headers as any);
      if (icfg.telemetryMode !== "off") {
        await sessionRegistry.recordStep(sk, report);
        const tr = sessionRegistry.getOrCreateTracker(sk);
        ingestCompanionChatCompleted({
          sessionId: tr.sessionId,
          runId: report.runId,
          report,
        });
      }
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
        mode: icfg.optimizationRunMode,
        tokensSaved: Math.max(0, optResult.inputTokensBefore - optResult.inputTokensAfter),
        inferencePath: "direct_provider",
        analyticsRecorded: !optResult.licenseLimited,
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

app.get("/v1/savings/summary", async (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : undefined;
  res.json(await getSavingsSummary(sessionId ? { sessionId } : undefined));
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

/** Optional: acknowledge sync intent — companion POSTs redacted summaries when signed in via setup (Supabase JWT). */
app.post("/v1/analytics/sync", (_req, res) => {
  const snap = loadConfig();
  res.json({
    ok: true,
    message:
      snap.syncAnalyticsToCloud && snap.telemetryMode !== "off"
        ? "Cloud sync is enabled: session summaries upload to your Spectyra account when a desktop Supabase session is present."
        : "Cloud sync is off or telemetry is off — set syncAnalyticsToCloud in ~/.spectyra/desktop/config.json or run setup while signed in.",
  });
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
  opt: OptimizeResult,
  usage: { inputTokens: number; outputTokens: number },
  modeCfg: CompanionConfig,
): SavingsReport {
  const savedRaw = opt.inputTokensBefore - opt.inputTokensAfter;
  const saved = opt.licenseLimited ? 0 : Math.max(0, savedRaw);
  const pct = opt.licenseLimited ? 0 : opt.inputTokensBefore > 0 ? (saved / opt.inputTokensBefore) * 100 : 0;
  const costInBefore = estimateInputCostUsd(opt.inputTokensBefore, model);
  const costInAfter = estimateInputCostUsd(
    opt.licenseLimited ? opt.inputTokensBefore : opt.inputTokensAfter,
    model,
  );
  const costOut = estimateOutputCostUsd(usage.outputTokens, model);
  const costBefore = costInBefore + costOut;
  const costAfter = costInAfter + costOut;
  const estSavings = opt.licenseLimited ? 0 : Math.max(0, costBefore - costAfter);
  const derived = opt.licenseLimited
    ? { duplicateReductionPct: undefined, flowStabilityScore: undefined, compressibleUnitsHint: undefined }
    : deriveSavingsMetrics(opt.features, opt.flowSignals);
  const notes: string[] = [];
  if (opt.optimizationSkippedReason === "tool_merge_failed") {
    notes.push(
      "Tool thread: structural optimization changed message count — original messages sent; savings shown are projected.",
    );
  } else if (opt.optimizationSkippedReason === "run_mode_off") {
    notes.push("Run mode is off; optimization skipped.");
  }
  if (opt.licenseLimited) {
    notes.push(
      "No estimated savings are recorded without an active trial or paid plan (provider received full messages). Activate savings on the local dashboard to apply trims and see dollar estimates.",
    );
  } else if (!opt.licenseLimited && modeCfg.optimizationRunMode === "observe" && saved > 0) {
    notes.push("Run mode is observe: projected savings shown; the provider received unoptimized messages.");
  }
  if (!modeCfg.spectyraAccountLinked && modeCfg.runMode === "on") {
    notes.push(
      "Spectyra account not complete: sign in and save your Spectyra API key (run spectyra-companion setup). Showing preview savings only.",
    );
  }
  if (opt.flowSignals?.isStuckLoop && !opt.licenseLimited) {
    notes.push("Flow: retry / error-loop pattern detected — consider clarifying the task or trimming context.");
  }
  return {
    runId,
    mode: modeCfg.optimizationRunMode,
    integrationType: "local-companion",
    provider,
    model,
    inputTokensBefore: opt.inputTokensBefore,
    inputTokensAfter: opt.licenseLimited ? opt.inputTokensBefore : opt.inputTokensAfter,
    outputTokens: usage.outputTokens,
    estimatedCostBefore: costBefore,
    estimatedCostAfter: costAfter,
    estimatedSavings: estSavings,
    estimatedSavingsPct: pct,
    contextReductionPct: opt.licenseLimited ? undefined : pct > 0 ? pct : undefined,
    duplicateReductionPct: opt.licenseLimited ? undefined : derived.duplicateReductionPct,
    flowReductionPct: opt.licenseLimited ? undefined : derived.flowStabilityScore,
    messageTurnCount: opt.licenseLimited ? undefined : opt.messageCount,
    compressibleUnitsHint: opt.licenseLimited ? undefined : derived.compressibleUnitsHint,
    repeatedContextTokensAvoided: opt.licenseLimited ? 0 : opt.repeatedContextTokensAvoided,
    repeatedToolOutputTokensAvoided: opt.licenseLimited ? 0 : opt.repeatedToolOutputTokensAvoided,
    telemetryMode: modeCfg.telemetryMode,
    promptSnapshotMode: modeCfg.promptSnapshots,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    transformsApplied: opt.licenseLimited ? [] : opt.transforms,
    notes: notes.length > 0 ? notes : undefined,
    success: true,
    createdAt: new Date().toISOString(),
  };
}

function attachSessionToReport(
  report: SavingsReport,
  headers: Record<string, string | string[] | undefined>,
): SavingsReport {
  const sk = sessionRegistry.sessionKeyFromRequest(headers);
  const tr = sessionRegistry.getOrCreateTracker(sk);
  return { ...report, sessionId: tr.sessionId, sessionKey: sk };
}

async function persistLocally(
  runId: string,
  report: SavingsReport,
  opt: OptimizeResult,
  originalMessages: ChatMessage[],
  modeCfg: CompanionConfig,
): Promise<void> {
  if (modeCfg.telemetryMode !== "off") {
    await saveRun(report).catch(() => {});
  }
  if (modeCfg.promptSnapshots === "local_only") {
    const lim = opt.licenseLimited;
    const afterTok = lim ? opt.inputTokensBefore : opt.inputTokensAfter;
    const savedSnap = lim ? 0 : Math.max(0, opt.inputTokensBefore - opt.inputTokensAfter);
    const comparison: PromptComparison = {
      originalMessagesSummary: originalMessages.map((m) => ({ role: m.role, len: (m.content ?? "").length })),
      optimizedMessagesSummary: opt.messages.map((m) => ({ role: m.role, len: (m.content ?? "").length })),
      diffSummary: {
        inputTokensBefore: opt.inputTokensBefore,
        inputTokensAfter: afterTok,
        tokensSaved: savedSnap,
        pctSaved: opt.inputTokensBefore > 0 ? (savedSnap / opt.inputTokensBefore) * 100 : 0,
        transformsApplied: lim ? [] : opt.transforms,
      },
      storageMode: "local_only",
      localOnly: true,
    };
    await savePromptComparison(runId, comparison).catch(() => {});
  }
}

// ── Start ────────────────────────────────────────────────────────────────────

const SESSION_REFRESH_INTERVAL_MS = 14 * 60 * 1000;

const server = app.listen(cfg.port, cfg.bindHost, () => {
  void ensureDesktopSessionRefreshed().catch(() => undefined);
  void refreshBillingEntitlement().catch(() => undefined);
  setInterval(() => {
    void ensureDesktopSessionRefreshed().catch(() => undefined);
  }, SESSION_REFRESH_INTERVAL_MS);

  const origin = `http://${cfg.bindHost}:${cfg.port}`;
  console.log(`\nSpectyra Local Companion`);
  console.log(`  Listening: ${origin}`);
  console.log(`  Savings UI: ${origin}/dashboard  (open in your browser)`);
  console.log(
    `  Run mode:  ${cfg.runMode}` +
      (cfg.runMode !== cfg.optimizationRunMode
        ? ` (optimization: ${cfg.optimizationRunMode} until account is linked)`
        : ""),
  );
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
