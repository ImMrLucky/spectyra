/**
 * Spectyra Desktop App — Electron main process.
 *
 * Embeds the Local Companion Express server in-process so the packaged
 * app has zero external runtime dependencies. No child process, no npx,
 * no tsx — just an Express server running inside Electron.
 */

import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { promises as fs } from "fs";
import { homedir } from "os";
import type { Server } from "http";
import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  SavingsReport,
  PromptComparison,
} from "@spectyra/core-types";

// ── Config ───────────────────────────────────────────────────────────────────

interface AppConfig {
  runMode: SpectyraRunMode;
  telemetryMode: TelemetryMode;
  promptSnapshots: PromptSnapshotMode;
  provider: string;
  port: number;
  licenseKey: string | null;
}

const CONFIG_DIR = path.join(homedir(), ".spectyra", "desktop");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DATA_DIR = path.join(homedir(), ".spectyra", "companion");

let config: AppConfig = {
  runMode: "observe",
  telemetryMode: "local",
  promptSnapshots: "local_only",
  provider: "openai",
  port: 4111,
  licenseKey: null,
};

async function loadConfig(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    const saved = JSON.parse(raw);
    config = { ...config, ...saved };
  } catch {
    // First launch — use defaults
  }
}

async function saveConfig(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

// ── Local store (same format as standalone companion) ────────────────────────

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function saveRun(report: SavingsReport): Promise<void> {
  await ensureDataDir();
  await fs.appendFile(path.join(DATA_DIR, "runs.jsonl"), JSON.stringify(report) + "\n", "utf-8");
}

async function savePromptComparison(runId: string, comparison: PromptComparison): Promise<void> {
  const dir = path.join(DATA_DIR, "comparisons");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${runId}.json`), JSON.stringify(comparison, null, 2), "utf-8");
}

async function getRuns(limit = 50): Promise<SavingsReport[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "runs.jsonl"), "utf-8");
    return raw.trim().split("\n").filter(Boolean).slice(-limit).map(l => JSON.parse(l));
  } catch { return []; }
}

async function getSavingsSummary() {
  const runs = await getRuns(10000);
  if (runs.length === 0) return { totalRuns: 0, totalTokensSaved: 0, totalCostSaved: 0, avgSavingsPct: 0 };
  let totalTokensSaved = 0, totalCostSaved = 0, totalPct = 0;
  for (const r of runs) {
    totalTokensSaved += Math.max(0, r.inputTokensBefore - r.inputTokensAfter);
    totalCostSaved += Math.max(0, r.estimatedSavings);
    totalPct += r.estimatedSavingsPct;
  }
  return { totalRuns: runs.length, totalTokensSaved, totalCostSaved, avgSavingsPct: totalPct / runs.length };
}

// ── Optimizer (same logic as standalone companion) ───────────────────────────

interface ChatMessage { role: string; content: string; }

function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const m of messages) chars += m.role.length + m.content.length + 4;
  return Math.ceil(chars / 4);
}

function applyOptimizations(messages: ChatMessage[]) {
  const transforms: string[] = [];
  let optimized = messages.map(m => ({
    ...m,
    content: m.content.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(),
  }));
  transforms.push("whitespace_normalize");

  const deduped: ChatMessage[] = [];
  for (const msg of optimized) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.role === msg.role && prev.content === msg.content) continue;
    deduped.push(msg);
  }
  if (deduped.length < optimized.length) transforms.push("dedup_consecutive");
  optimized = deduped;

  optimized = optimized.map(m => {
    if (m.role === "tool" && m.content.length > 2000) {
      transforms.push("tool_output_truncate");
      return { ...m, content: `${m.content.slice(0, 500)}\n...[truncated]...\n${m.content.slice(-500)}` };
    }
    return m;
  });

  if (optimized.length > 20) {
    const sys = optimized.filter(m => m.role === "system");
    const rest = optimized.filter(m => m.role !== "system");
    optimized = [...sys, ...rest.slice(-16)];
    transforms.push("context_window_trim");
  }

  return { messages: optimized, transforms };
}

function optimize(messages: ChatMessage[], runMode: SpectyraRunMode) {
  const inputTokensBefore = estimateTokens(messages);
  if (runMode === "off") {
    return { messages: [...messages], inputTokensBefore, inputTokensAfter: inputTokensBefore, transforms: [] as string[] };
  }
  const { messages: optimized, transforms } = applyOptimizations(messages);
  const inputTokensAfter = estimateTokens(optimized);
  if (runMode === "observe") {
    return { messages: [...messages], inputTokensBefore, inputTokensAfter, transforms };
  }
  return { messages: optimized, inputTokensBefore, inputTokensAfter, transforms };
}

// ── Provider callers ─────────────────────────────────────────────────────────

let sessionProviderKeys: Record<string, string> = {};

function getProviderKey(provider: string): string {
  return sessionProviderKeys[provider] || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
}

async function callProvider(provider: string, model: string, messages: ChatMessage[]) {
  const key = getProviderKey(provider);
  if (!key) throw new Error(`No API key for ${provider}. Add it in Settings → Provider Keys.`);

  if (provider === "openai" || provider === "groq") {
    const baseUrl = provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: messages.map(m => ({ role: m.role, content: m.content })) }),
    });
    if (!res.ok) throw new Error(`${provider} API error: ${res.status} ${await res.text()}`);
    const data = await res.json() as any;
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
    };
  }

  if (provider === "anthropic") {
    const systemMsg = messages.find(m => m.role === "system");
    const nonSystem = messages.filter(m => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model, max_tokens: 4096, system: systemMsg?.content,
        messages: nonSystem.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`anthropic API error: ${res.status} ${await res.text()}`);
    const data = await res.json() as any;
    return {
      text: data.content?.filter((b: any) => b.type === "text").map((b: any) => b.text).join("") ?? "",
      usage: { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 },
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

function detectProvider(model: string, hintFormat: string): string {
  if (model.includes("claude") || model.includes("anthropic") || hintFormat === "anthropic") return "anthropic";
  if (model.includes("llama") || model.includes("mixtral")) return "groq";
  return "openai";
}

// ── Embedded companion server ────────────────────────────────────────────────

let companionServer: Server | null = null;

function startCompanionServer(): void {
  if (companionServer) return;

  const srv = express();
  srv.use(cors());
  srv.use(express.json({ limit: "10mb" }));

  srv.get("/health", (_req, res) => {
    res.json({
      status: "ok", service: "spectyra-desktop-companion",
      runMode: config.runMode, telemetryMode: config.telemetryMode,
      promptSnapshots: config.promptSnapshots,
      inferencePath: "direct_provider", providerBillingOwner: "customer",
    });
  });

  srv.get("/config", (_req, res) => {
    res.json({
      runMode: config.runMode, telemetryMode: config.telemetryMode,
      promptSnapshots: config.promptSnapshots, port: config.port,
      provider: config.provider, inferencePath: "direct_provider",
      providerBillingOwner: "customer", cloudRelay: "none",
    });
  });

  // OpenAI-compatible
  srv.post("/v1/chat/completions", async (req, res) => {
    try {
      const model: string = req.body.model || "gpt-4o-mini";
      const messages: ChatMessage[] = (req.body.messages || []).map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      }));
      const provider = detectProvider(model, "openai");
      const optResult = optimize(messages, config.runMode);
      const providerResult = await callProvider(provider, model, optResult.messages);
      const runId = crypto.randomUUID();

      const report: SavingsReport = buildReport(runId, provider, model, optResult, providerResult.usage);
      await persistLocally(runId, report, optResult, messages);

      res.json({
        id: `chatcmpl-${runId}`, object: "chat.completion", created: Math.floor(Date.now() / 1000), model,
        choices: [{ index: 0, message: { role: "assistant", content: providerResult.text }, finish_reason: "stop" }],
        usage: { prompt_tokens: providerResult.usage.inputTokens, completion_tokens: providerResult.usage.outputTokens, total_tokens: providerResult.usage.inputTokens + providerResult.usage.outputTokens },
        spectyra: { runId, mode: config.runMode, inputTokensBefore: optResult.inputTokensBefore, inputTokensAfter: optResult.inputTokensAfter, tokensSaved: Math.max(0, optResult.inputTokensBefore - optResult.inputTokensAfter), transforms: optResult.transforms, inferencePath: "direct_provider" },
      });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message, type: "companion_error" } });
    }
  });

  // Anthropic-compatible
  srv.post("/v1/messages", async (req, res) => {
    try {
      const model: string = req.body.model || "claude-3-5-sonnet-latest";
      const messages: ChatMessage[] = [];
      if (req.body.system) messages.push({ role: "system", content: req.body.system });
      for (const m of req.body.messages || []) {
        messages.push({ role: m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) });
      }
      const provider = detectProvider(model, "anthropic");
      const optResult = optimize(messages, config.runMode);
      const providerResult = await callProvider(provider, model, optResult.messages);
      const runId = crypto.randomUUID();
      const report: SavingsReport = buildReport(runId, provider, model, optResult, providerResult.usage);
      await persistLocally(runId, report, optResult, messages);

      res.json({
        id: `msg-${runId}`, type: "message", role: "assistant",
        content: [{ type: "text", text: providerResult.text }],
        model, stop_reason: "end_turn",
        usage: { input_tokens: providerResult.usage.inputTokens, output_tokens: providerResult.usage.outputTokens },
        spectyra: { runId, mode: config.runMode, tokensSaved: Math.max(0, optResult.inputTokensBefore - optResult.inputTokensAfter), inferencePath: "direct_provider" },
      });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message, type: "companion_error" } });
    }
  });

  // Local analytics
  srv.get("/v1/runs", async (req, res) => {
    const limit = parseInt(req.query.limit as string || "50", 10);
    res.json(await getRuns(limit));
  });
  srv.get("/v1/savings/summary", async (_req, res) => res.json(await getSavingsSummary()));
  srv.get("/v1/prompt-comparison/:runId", async (req, res) => {
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, "comparisons", `${req.params.runId}.json`), "utf-8");
      res.json(JSON.parse(raw));
    } catch { res.status(404).json({ error: "Not found" }); }
  });

  companionServer = srv.listen(config.port, "127.0.0.1", () => {
    console.log(`Companion server running on http://127.0.0.1:${config.port}`);
    mainWindow?.webContents.send("companion-status", { running: true, port: config.port });
  });
}

function stopCompanionServer(): void {
  companionServer?.close();
  companionServer = null;
  mainWindow?.webContents.send("companion-status", { running: false });
}

function buildReport(
  runId: string, provider: string, model: string,
  opt: { inputTokensBefore: number; inputTokensAfter: number; transforms: string[] },
  usage: { inputTokens: number; outputTokens: number },
): SavingsReport {
  const saved = opt.inputTokensBefore - opt.inputTokensAfter;
  const pct = opt.inputTokensBefore > 0 ? (saved / opt.inputTokensBefore) * 100 : 0;
  return {
    runId, mode: config.runMode, integrationType: "local-companion", provider, model,
    inputTokensBefore: opt.inputTokensBefore, inputTokensAfter: opt.inputTokensAfter,
    outputTokens: usage.outputTokens,
    estimatedCostBefore: 0, estimatedCostAfter: 0, estimatedSavings: 0, estimatedSavingsPct: pct,
    contextReductionPct: pct > 0 ? pct : undefined,
    telemetryMode: config.telemetryMode, promptSnapshotMode: config.promptSnapshots,
    inferencePath: "direct_provider", providerBillingOwner: "customer",
    transformsApplied: opt.transforms, success: true, createdAt: new Date().toISOString(),
  };
}

async function persistLocally(
  runId: string, report: SavingsReport,
  opt: { inputTokensBefore: number; inputTokensAfter: number; transforms: string[]; messages: ChatMessage[] },
  originalMessages: ChatMessage[],
): Promise<void> {
  if (config.telemetryMode !== "off") await saveRun(report).catch(() => {});
  if (config.promptSnapshots === "local_only") {
    const comparison: PromptComparison = {
      originalMessagesSummary: originalMessages.map(m => ({ role: m.role, len: m.content.length })),
      optimizedMessagesSummary: opt.messages.map(m => ({ role: m.role, len: m.content.length })),
      diffSummary: {
        inputTokensBefore: opt.inputTokensBefore, inputTokensAfter: opt.inputTokensAfter,
        tokensSaved: Math.max(0, opt.inputTokensBefore - opt.inputTokensAfter),
        pctSaved: opt.inputTokensBefore > 0 ? ((opt.inputTokensBefore - opt.inputTokensAfter) / opt.inputTokensBefore) * 100 : 0,
        transformsApplied: opt.transforms,
      },
      storageMode: "local_only", localOnly: true,
    };
    await savePromptComparison(runId, comparison).catch(() => {});
  }
}

// ── Electron window ──────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    title: "Spectyra",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "ui", "index.html"));
  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle("companion:start", () => { startCompanionServer(); return true; });
ipcMain.handle("companion:stop", () => { stopCompanionServer(); return true; });
ipcMain.handle("companion:status", () => ({
  running: !!companionServer, port: config.port,
}));
ipcMain.handle("companion:health", async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${config.port}/health`);
    return await res.json();
  } catch { return null; }
});

ipcMain.handle("config:get", () => ({ ...config, licenseKey: config.licenseKey ? "••••" : null }));
ipcMain.handle("config:save", async (_e, partial: Partial<AppConfig>) => {
  config = { ...config, ...partial };
  await saveConfig();
  // Restart companion if port or mode changed
  if (companionServer) { stopCompanionServer(); startCompanionServer(); }
  return true;
});

ipcMain.handle("provider-key:set", (_e, provider: string, key: string) => {
  sessionProviderKeys[provider] = key;
  return true;
});
ipcMain.handle("provider-key:test", async (_e, provider: string) => {
  const key = getProviderKey(provider);
  if (!key) return { ok: false, error: "No key set" };
  try {
    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
      return { ok: r.ok, status: r.status };
    }
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      });
      return { ok: r.ok || r.status === 400, status: r.status };
    }
    if (provider === "groq") {
      const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
      return { ok: r.ok, status: r.status };
    }
    return { ok: false, error: "Unknown provider" };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("license:activate", async (_e, licenseKey: string) => {
  const apiUrl = process.env.SPECTYRA_API_URL || "https://spectyra.up.railway.app/v1";
  try {
    const res = await fetch(`${apiUrl}/license/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: licenseKey }),
    });
    const data = await res.json() as any;
    if (data.valid) {
      config.licenseKey = licenseKey;
      await saveConfig();
      return { ok: true, entitlement: data.entitlement };
    }
    return { ok: false, error: data.error || "Invalid license key" };
  } catch (err: any) {
    return { ok: false, error: `Cannot reach Spectyra API: ${err.message}` };
  }
});

ipcMain.handle("license:check", async () => {
  if (!config.licenseKey) return { ok: false, error: "No license key" };
  const apiUrl = process.env.SPECTYRA_API_URL || "https://spectyra.up.railway.app/v1";
  try {
    const res = await fetch(`${apiUrl}/license/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: config.licenseKey }),
    });
    const data = await res.json() as any;
    return data.valid ? { ok: true, entitlement: data.entitlement } : { ok: false, error: data.error };
  } catch {
    return { ok: true, offline: true, message: "Offline — using cached entitlement" };
  }
});

ipcMain.handle("license:clear", async () => {
  config.licenseKey = null;
  await saveConfig();
  return true;
});

ipcMain.handle("app:info", () => ({
  version: app.getVersion(),
  platform: process.platform,
  dataDir: DATA_DIR,
  configDir: CONFIG_DIR,
}));

ipcMain.handle("app:open-data-dir", () => { shell.openPath(DATA_DIR); });

// ── Lifecycle ────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await loadConfig();
  createWindow();
  startCompanionServer();
});

app.on("window-all-closed", () => {
  stopCompanionServer();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
