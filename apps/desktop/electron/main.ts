/**
 * Spectyra Desktop — Electron main process.
 * Spawns Local Companion as a child process (Electron's Node runtime via ELECTRON_RUN_AS_NODE).
 */

import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import { homedir } from "os";
import { defaultAliasModels, OPENCLAW_CONFIG_EXAMPLE_JSON } from "@spectyra/shared";
import type { SpectyraRunMode, TelemetryMode, PromptSnapshotMode } from "@spectyra/core-types";

interface AppConfig {
  runMode: SpectyraRunMode;
  telemetryMode: TelemetryMode;
  promptSnapshots: PromptSnapshotMode;
  provider: string;
  aliasSmartModel: string;
  aliasFastModel: string;
  port: number;
  licenseKey: string | null;
  /** Stored only on disk under ~/.spectyra/desktop — never sent to Spectyra cloud. */
  providerKeys?: Record<string, string>;
}

const CONFIG_DIR = path.join(homedir(), ".spectyra", "desktop");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DATA_DIR = path.join(homedir(), ".spectyra", "companion");

const _defaults = defaultAliasModels("openai");
let config: AppConfig = {
  runMode: "on",
  telemetryMode: "local",
  promptSnapshots: "local_only",
  provider: "openai",
  aliasSmartModel: _defaults.smart,
  aliasFastModel: _defaults.fast,
  port: 4111,
  licenseKey: null,
};

let mainWindow: BrowserWindow | null = null;
let companionProcess: ChildProcess | null = null;

async function loadConfig(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    const saved = JSON.parse(raw);
    config = { ...config, ...saved };
    if (!["openai", "anthropic", "groq"].includes(config.provider)) {
      config.provider = "openai";
    }
    const defs = defaultAliasModels(config.provider);
    if (!config.aliasSmartModel) config.aliasSmartModel = defs.smart;
    if (!config.aliasFastModel) config.aliasFastModel = defs.fast;
  } catch {
    // first launch
  }
}

async function saveConfig(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

function repoRootFromMain(): string {
  return path.join(__dirname, "..", "..", "..");
}

function companionPaths(): { script: string; cwd: string } {
  if (app.isPackaged) {
    const root = path.join(process.resourcesPath, "companion");
    return {
      script: path.join(root, "dist", "companion.js"),
      cwd: root,
    };
  }
  const root = repoRootFromMain();
  return {
    script: path.join(root, "tools", "local-companion", "dist", "companion.js"),
    cwd: path.join(root, "tools", "local-companion"),
  };
}

function companionEnv(): NodeJS.ProcessEnv {
  const keys = config.providerKeys || {};
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    SPECTYRA_RUN_MODE: config.runMode,
    SPECTYRA_TELEMETRY: config.telemetryMode,
    SPECTYRA_PROMPT_SNAPSHOTS: config.promptSnapshots,
    SPECTYRA_PORT: String(config.port),
    SPECTYRA_PROVIDER: config.provider,
    SPECTYRA_ALIAS_SMART_MODEL: config.aliasSmartModel,
    SPECTYRA_ALIAS_FAST_MODEL: config.aliasFastModel,
    SPECTYRA_BIND_HOST: "127.0.0.1",
    SPECTYRA_KEY_SOURCE: "session",
    SPECTYRA_PROVIDER_KEYS_JSON: JSON.stringify(keys),
    SPECTYRA_LICENSE_KEY: config.licenseKey || "",
  };
}

function stopCompanion(): void {
  if (companionProcess) {
    try {
      companionProcess.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    companionProcess = null;
  }
  mainWindow?.webContents.send("companion-status", { running: false });
}

function startCompanion(): void {
  stopCompanion();
  const { script, cwd } = companionPaths();
  companionProcess = spawn(process.execPath, [script], {
    cwd,
    env: companionEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  companionProcess.stderr?.on("data", (d) => {
    if (!app.isPackaged) console.error("[companion]", d.toString());
  });
  companionProcess.stdout?.on("data", (d) => {
    if (!app.isPackaged) console.log("[companion]", d.toString());
  });
  companionProcess.on("exit", (code) => {
    companionProcess = null;
    mainWindow?.webContents.send("companion-status", { running: false, code });
  });
  mainWindow?.webContents.send("companion-status", { running: true, port: config.port });
}

async function waitForHealth(timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  const url = `http://127.0.0.1:${config.port}/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    title: "Spectyra",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.SPECTYRA_ELECTRON_DEV_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexHtml = path.join(__dirname, "..", "dist", "renderer", "browser", "index.html");
    void mainWindow.loadFile(indexHtml);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle("companion:start", () => {
  startCompanion();
  return true;
});
ipcMain.handle("companion:stop", () => {
  stopCompanion();
  return true;
});
ipcMain.handle("companion:status", () => ({
  running: !!companionProcess,
  port: config.port,
}));
ipcMain.handle("companion:health", async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${config.port}/health`);
    return await res.json();
  } catch {
    return null;
  }
});

ipcMain.handle("openclaw:example-config", () => OPENCLAW_CONFIG_EXAMPLE_JSON);

ipcMain.handle("config:get", () => ({
  ...config,
  licenseKey: config.licenseKey ? "••••" : null,
  providerKeys: config.providerKeys,
}));
ipcMain.handle("config:save", async (_e, partial: Partial<AppConfig>) => {
  config = { ...config, ...partial };
  if (partial.provider !== undefined && partial.aliasSmartModel === undefined && partial.aliasFastModel === undefined) {
    const defs = defaultAliasModels(config.provider);
    config.aliasSmartModel = defs.smart;
    config.aliasFastModel = defs.fast;
  }
  await saveConfig();
  stopCompanion();
  startCompanion();
  void waitForHealth();
  return true;
});

ipcMain.handle("provider-key:set", async (_e, provider: string, key: string) => {
  config.providerKeys = { ...config.providerKeys, [provider]: key };
  await saveConfig();
  stopCompanion();
  startCompanion();
  void waitForHealth();
  return true;
});

ipcMain.handle("provider-key:test", async (_e, provider: string) => {
  const key = config.providerKeys?.[provider] || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
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
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
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
    const data = (await res.json()) as { valid?: boolean; entitlement?: unknown; error?: string };
    if (data.valid) {
      config.licenseKey = licenseKey;
      await saveConfig();
      stopCompanion();
      startCompanion();
      void waitForHealth();
      return { ok: true, entitlement: data.entitlement };
    }
    return { ok: false, error: data.error || "Invalid license key" };
  } catch (err: unknown) {
    return { ok: false, error: `Cannot reach Spectyra API: ${err instanceof Error ? err.message : String(err)}` };
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
    const data = (await res.json()) as { valid?: boolean; entitlement?: unknown; error?: string };
    return data.valid ? { ok: true, entitlement: data.entitlement } : { ok: false, error: data.error };
  } catch {
    return { ok: true, offline: true, message: "Offline — using cached entitlement" };
  }
});

ipcMain.handle("license:clear", async () => {
  config.licenseKey = null;
  await saveConfig();
  stopCompanion();
  startCompanion();
  void waitForHealth();
  return true;
});

ipcMain.handle("app:info", () => ({
  version: app.getVersion(),
  platform: process.platform,
  dataDir: DATA_DIR,
  configDir: CONFIG_DIR,
}));

ipcMain.handle("app:companion-base-url", () => `http://127.0.0.1:${config.port}/v1`);

ipcMain.handle("app:open-data-dir", () => {
  void shell.openPath(DATA_DIR);
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await loadConfig();
  createWindow();
  startCompanion();
  const ok = await waitForHealth();
  if (!ok && mainWindow) {
    console.warn("[spectyra] Local Companion did not respond on /health in time");
  }
});

app.on("window-all-closed", () => {
  stopCompanion();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  stopCompanion();
});
