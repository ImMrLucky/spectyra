/**
 * Spectyra Desktop — Electron main process.
 * Spawns Local Companion as a child process (Electron's Node runtime via ELECTRON_RUN_AS_NODE).
 */

import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import { execFileSync } from "child_process";
import path from "path";
import { spawn, execFile, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import { homedir, tmpdir } from "os";
import {
  defaultAliasModels,
  OPENCLAW_CONFIG_EXAMPLE_JSON,
  buildOpenClawFullInstallLine,
  buildOpenClawWindowsInstallPs1Content,
  type OpenClawOnboardOptions,
  type OpenClawInstallPlatform,
} from "@spectyra/shared";
import type { SpectyraRunMode, TelemetryMode, PromptSnapshotMode } from "@spectyra/core-types";

interface AppConfig {
  runMode: SpectyraRunMode;
  telemetryMode: TelemetryMode;
  promptSnapshots: PromptSnapshotMode;
  provider: string;
  aliasSmartModel: string;
  aliasFastModel: string;
  aliasQualityModel: string;
  port: number;
  licenseKey: string | null;
  /** Stored only on disk under ~/.spectyra/desktop — never sent to Spectyra cloud. */
  providerKeys?: Record<string, string>;
}

const CONFIG_DIR = path.join(homedir(), ".spectyra", "desktop");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DATA_DIR = path.join(homedir(), ".spectyra", "companion");

/** Avoid a second Spectyra instance binding the same companion port. */
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
  process.exit(0);
}

async function readJsonBody<T>(res: Response): Promise<{ ok: boolean; data?: T; error?: string }> {
  const text = await res.text();
  if (!text.trim()) {
    return { ok: false, error: `Empty response (${res.status})` };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, error: `Invalid JSON (${res.status})` };
  }
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

const _defaults = defaultAliasModels("openai");
let config: AppConfig = {
  runMode: "on",
  telemetryMode: "local",
  promptSnapshots: "local_only",
  provider: "openai",
  aliasSmartModel: _defaults.smart,
  aliasFastModel: _defaults.fast,
  aliasQualityModel: _defaults.quality,
  port: 4111,
  licenseKey: null,
};

let mainWindow: BrowserWindow | null = null;
let companionProcess: ChildProcess | null = null;

async function loadConfig(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    const saved = JSON.parse(raw) as Partial<AppConfig>;
    config = { ...config, ...saved };
    const p = config.port;
    if (typeof p !== "number" || !Number.isInteger(p) || p < 1 || p > 65535) {
      config.port = 4111;
    }
    if (!["openai", "anthropic", "groq"].includes(config.provider)) {
      config.provider = "openai";
    }
    const defs = defaultAliasModels(config.provider);
    if (!config.aliasSmartModel) config.aliasSmartModel = defs.smart;
    if (!config.aliasFastModel) config.aliasFastModel = defs.fast;
    if (!config.aliasQualityModel) config.aliasQualityModel = defs.quality;
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
      script: path.join(root, "dist", "companion.cjs"),
      cwd: root,
    };
  }
  const root = repoRootFromMain();
  return {
    script: path.join(root, "tools", "local-companion", "dist", "companion.cjs"),
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
    SPECTYRA_ALIAS_QUALITY_MODEL: config.aliasQualityModel,
    SPECTYRA_BIND_HOST: "127.0.0.1",
    SPECTYRA_DESKTOP_MANAGED: "1",
    SPECTYRA_ACCOUNT_SIGNED_IN: "1",
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
  if (!existsSync(script)) {
    const msg = `Local Companion is missing at:\n${script}\n\nReinstall the app, or from dev run: pnpm --filter @spectyra/local-companion build && pnpm desktop:dist`;
    if (app.isPackaged) {
      dialog.showErrorBox("Spectyra — companion missing", msg);
    } else {
      console.error("[spectyra]", msg);
    }
    mainWindow?.webContents.send("companion-status", { running: false, code: -2 });
    return;
  }
  try {
    companionProcess = spawn(process.execPath, [script], {
      cwd,
      env: companionEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox("Spectyra — companion failed to start", m);
    mainWindow?.webContents.send("companion-status", { running: false, code: -3 });
    return;
  }
  companionProcess.stderr?.on("data", (d) => {
    if (!app.isPackaged) console.error("[companion]", d.toString());
  });
  companionProcess.stdout?.on("data", (d) => {
    if (!app.isPackaged) console.log("[companion]", d.toString());
  });
  companionProcess.on("error", (err) => {
    companionProcess = null;
    const m = err.message;
    if (app.isPackaged) {
      dialog.showErrorBox("Spectyra — companion process error", m);
    } else {
      console.error("[spectyra] companion spawn error", err);
    }
    mainWindow?.webContents.send("companion-status", { running: false, code: -1 });
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

function resolveRendererIndexHtml(): string {
  const base = path.join(__dirname, "..", "dist", "renderer");
  const candidates = [
    path.join(base, "browser", "index.html"),
    path.join(base, "index.html"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

function createWindow(): void {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "..", "assets", "icon.png")
    : path.join(__dirname, "..", "assets", "icon.png");

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    title: "Spectyra",
    show: false,
    icon: iconPath,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  const devUrl = process.env.SPECTYRA_ELECTRON_DEV_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl).catch((err) => {
      dialog.showErrorBox(
        "Spectyra",
        `Could not load the dev UI.\n\n${err instanceof Error ? err.message : String(err)}`,
      );
      mainWindow?.show();
    });
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexHtml = resolveRendererIndexHtml();
    if (!existsSync(indexHtml)) {
      dialog.showErrorBox(
        "Spectyra — UI missing",
        `The app package is missing the web UI files.\n\nExpected something like:\n${indexHtml}\n\nReinstall Spectyra, or rebuild with: pnpm desktop:dist`,
      );
      mainWindow.show();
      return;
    }
    mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
      dialog.showErrorBox(
        "Spectyra — page failed to load",
        `Could not load the UI (${code}): ${desc}\n\n${url}`,
      );
    });
    void mainWindow.loadFile(indexHtml).catch((err) => {
      dialog.showErrorBox(
        "Spectyra — UI failed",
        `Failed to open the UI file.\n\n${err instanceof Error ? err.message : String(err)}\n\nPath: ${indexHtml}`,
      );
      mainWindow?.show();
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle("companion:start", async () => {
  const { script } = companionPaths();
  if (!existsSync(script)) {
    return { ok: false as const, reason: "missing" as const };
  }
  startCompanion();
  const healthy = await waitForHealth(30000);
  return healthy ? ({ ok: true as const } as const) : ({ ok: false as const, reason: "health_timeout" as const } as const);
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

/**
 * Fetch diagnostics from the Local Companion using Node (main process).
 * The renderer cannot reliably fetch http://127.0.0.1 from file:// (packaged app) due to web security.
 */
ipcMain.handle("companion:get-setup-status", async () => {
  const port = config.port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const [rs, ro] = await Promise.all([
      fetch(`${base}/diagnostics/status`),
      fetch(`${base}/diagnostics/integrations/openclaw`),
    ]);
    let statusJson: Record<string, unknown> | null = null;
    let openclawJson: { detected?: boolean; connected?: boolean } | null = null;
    if (rs.ok) {
      try {
        statusJson = (await rs.json()) as Record<string, unknown>;
      } catch {
        return { fetchOk: false as const, error: "invalid JSON from diagnostics/status" };
      }
    }
    if (ro.ok) {
      try {
        openclawJson = (await ro.json()) as { detected?: boolean; connected?: boolean };
      } catch {
        return { fetchOk: false as const, error: "invalid JSON from diagnostics/integrations/openclaw" };
      }
    }
    return {
      fetchOk: true as const,
      statusOk: rs.ok,
      statusHttp: rs.status,
      statusJson,
      openclawOk: ro.ok,
      openclawHttp: ro.status,
      openclawJson,
    };
  } catch (e) {
    return {
      fetchOk: false as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }
});

ipcMain.handle("openclaw:example-config", () => OPENCLAW_CONFIG_EXAMPLE_JSON);

ipcMain.handle("openclaw:detect-cli", async () => {
  try {
    if (process.platform === "win32") {
      execFileSync("where", ["openclaw"], { stdio: "ignore" });
    } else {
      execFileSync("which", ["openclaw"], { stdio: "ignore" });
    }
    return { available: true };
  } catch {
    return { available: false };
  }
});

function electronOpenClawPlatform(): OpenClawInstallPlatform {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "win32") return "win32";
  if (process.platform === "linux") return "linux";
  return "other";
}

/** Opens Terminal (macOS), PowerShell script (Windows), or x-terminal-emulator (Linux) with the OpenClaw install line. */
ipcMain.handle(
  "openclaw:run-onboard-terminal",
  async (_e, opts?: OpenClawOnboardOptions): Promise<{ ok: boolean; error?: string }> => {
    if (process.platform === "win32") {
      let psContent: string;
      try {
        psContent = buildOpenClawWindowsInstallPs1Content(opts ?? {});
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      try {
        const tmpDir = await fs.mkdtemp(path.join(tmpdir(), "spectyra-openclaw-"));
        const psPath = path.join(tmpDir, "openclaw-onboard.ps1");
        await fs.writeFile(psPath, psContent, "utf8");
        const child = spawn("powershell.exe", ["-NoExit", "-ExecutionPolicy", "Bypass", "-File", psPath], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    let line: string;
    try {
      line = buildOpenClawFullInstallLine(opts ?? {}, electronOpenClawPlatform());
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    try {
    if (process.platform === "darwin") {
      const escaped = line.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      execFile("osascript", ["-e", `tell application "Terminal" to do script "${escaped}"`]);
      return { ok: true };
    }

    /** Linux / other: try common terminal emulators */
    const bashArgs = ["-lc", line];
    if (existsSync("/usr/bin/x-terminal-emulator")) {
      execFile("/usr/bin/x-terminal-emulator", ["-e", "bash", ...bashArgs]);
      return { ok: true };
    }
    if (existsSync("/usr/bin/gnome-terminal")) {
      execFile("/usr/bin/gnome-terminal", ["--", "bash", ...bashArgs]);
      return { ok: true };
    }
    if (existsSync("/usr/bin/konsole")) {
      execFile("/usr/bin/konsole", ["-e", "bash", ...bashArgs]);
      return { ok: true };
    }
    return {
      ok: false,
      error: "No supported terminal found. Run the install command manually in a terminal.",
    };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
);

ipcMain.handle("config:get", () => ({
  ...config,
  licenseKey: config.licenseKey ? "••••" : null,
  providerKeys: config.providerKeys,
}));
ipcMain.handle("config:save", async (_e, partial: Partial<AppConfig>) => {
  config = { ...config, ...partial };
  if (partial.port !== undefined) {
    const n = Number(partial.port);
    if (Number.isInteger(n) && n > 0 && n < 65536) {
      config.port = n;
    }
  }
  if (
    partial.provider !== undefined &&
    partial.aliasSmartModel === undefined &&
    partial.aliasFastModel === undefined &&
    partial.aliasQualityModel === undefined
  ) {
    const defs = defaultAliasModels(config.provider);
    config.aliasSmartModel = defs.smart;
    config.aliasFastModel = defs.fast;
    config.aliasQualityModel = defs.quality;
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
    const parsed = await readJsonBody<{ valid?: boolean; entitlement?: unknown; error?: string }>(res);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error || "Invalid response from server" };
    }
    const data = parsed.data!;
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
    const parsed = await readJsonBody<{ valid?: boolean; entitlement?: unknown; error?: string }>(res);
    if (!parsed.ok) {
      return { ok: true, offline: true, message: parsed.error || "Could not parse license response" };
    }
    const data = parsed.data!;
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
  if (process.platform !== "darwin") {
    stopCompanion();
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  stopCompanion();
});
