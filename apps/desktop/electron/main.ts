/**
 * Spectyra Desktop — Electron main process.
 * Spawns Local Companion as a child process (Electron's Node runtime via ELECTRON_RUN_AS_NODE).
 */

import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import { execFileSync } from "child_process";
import path from "path";
import { spawn, execFile, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import { existsSync, mkdirSync, writeFileSync } from "fs";
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
/** Written before each companion spawn — companion reads this path (avoids env JSON size/escaping limits). */
const PROVIDER_KEYS_FILE = path.join(CONFIG_DIR, "provider-keys.json");
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

/** True if the companion can obtain a key for this provider (saved keys or process env). */
function hasProviderCredential(provider: string): boolean {
  const p = provider.toLowerCase();
  if (!["openai", "anthropic", "groq"].includes(p)) return false;
  const keys = config.providerKeys || {};
  if (typeof keys[p] === "string" && keys[p].trim().length > 0) return true;
  if (p === "openai" && (process.env.OPENAI_API_KEY || "").trim()) return true;
  if (p === "anthropic" && (process.env.ANTHROPIC_API_KEY || "").trim()) return true;
  if (p === "groq" && (process.env.GROQ_API_KEY || "").trim()) return true;
  return false;
}

function companionEnv(): NodeJS.ProcessEnv {
  const keys = config.providerKeys || {};
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
  try {
    writeFileSync(PROVIDER_KEYS_FILE, JSON.stringify(keys, null, 2), "utf-8");
  } catch {
    /* ignore */
  }
  const keysJson = JSON.stringify(keys);
  const providerNorm = ["openai", "anthropic", "groq"].includes(config.provider)
    ? config.provider
    : "openai";
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    SPECTYRA_RUN_MODE: config.runMode,
    SPECTYRA_TELEMETRY: config.telemetryMode,
    SPECTYRA_PROMPT_SNAPSHOTS: config.promptSnapshots,
    SPECTYRA_PORT: String(config.port),
    SPECTYRA_PROVIDER: providerNorm,
    SPECTYRA_PROVIDER_KEYS_FILE: PROVIDER_KEYS_FILE,
    SPECTYRA_ALIAS_SMART_MODEL: config.aliasSmartModel,
    SPECTYRA_ALIAS_FAST_MODEL: config.aliasFastModel,
    SPECTYRA_ALIAS_QUALITY_MODEL: config.aliasQualityModel,
    SPECTYRA_BIND_HOST: "127.0.0.1",
    SPECTYRA_DESKTOP_MANAGED: "1",
    SPECTYRA_ACCOUNT_SIGNED_IN: "1",
    SPECTYRA_KEY_SOURCE: "session",
    SPECTYRA_PROVIDER_KEYS_JSON: keysJson,
    /** Belt-and-suspenders: companion also reads these if session JSON is ever empty in edge cases. */
    OPENAI_API_KEY: keys.openai ?? process.env.OPENAI_API_KEY ?? "",
    ANTHROPIC_API_KEY: keys.anthropic ?? process.env.ANTHROPIC_API_KEY ?? "",
    GROQ_API_KEY: keys.groq ?? process.env.GROQ_API_KEY ?? "",
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

interface CompanionHealthBody {
  status?: string;
  service?: string;
  providerConfigured?: boolean;
}

function isSpectyraCompanionHealth(j: CompanionHealthBody): boolean {
  return j.service === "spectyra-local-companion" && j.status === "ok";
}

async function waitForHealth(timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  const url = `http://127.0.0.1:${config.port}/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (!r.ok) {
        await new Promise((x) => setTimeout(x, 300));
        continue;
      }
      const j = (await r.json()) as CompanionHealthBody;
      if (isSpectyraCompanionHealth(j)) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/** After restart, wait until OUR companion reports provider keys (avoids stale process on same port). */
async function waitForHealthProviderReady(timeoutMs = 45000): Promise<boolean> {
  const start = Date.now();
  const url = `http://127.0.0.1:${config.port}/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (!r.ok) {
        await new Promise((x) => setTimeout(x, 350));
        continue;
      }
      const j = (await r.json()) as CompanionHealthBody;
      if (isSpectyraCompanionHealth(j) && j.providerConfigured === true) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
    title: process.env.SPECTYRA_EDITION === "pro" ? "Spectyra" : "Spectyra for OpenClaw",
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
      try {
        const tmpDir = await fs.mkdtemp(path.join(tmpdir(), "spectyra-openclaw-"));
        const shPath = path.join(tmpDir, "openclaw-onboard.sh");
        await fs.writeFile(shPath, `#!/bin/bash\n${line}\n`, { mode: 0o755 });
        const child = spawn("open", ["-a", "Terminal", shPath], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        return { ok: true };
      } catch (darwinErr) {
        return { ok: false, error: `Could not open Terminal: ${darwinErr instanceof Error ? darwinErr.message : String(darwinErr)}. Copy the command and run it in Terminal manually.` };
      }
    }

    /** Linux / other: try common terminal emulators */
    const bashArgs = ["-lc", line];
    const tryTerminal = (cmd: string, args: string[]): Promise<{ ok: boolean; error?: string }> => {
      return new Promise((resolve) => {
        const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
        child.unref();
        child.on("error", (err) => resolve({ ok: false, error: err.message }));
        setTimeout(() => resolve({ ok: true }), 200);
      });
    };
    if (existsSync("/usr/bin/x-terminal-emulator")) {
      return tryTerminal("/usr/bin/x-terminal-emulator", ["-e", "bash", ...bashArgs]);
    }
    if (existsSync("/usr/bin/gnome-terminal")) {
      return tryTerminal("/usr/bin/gnome-terminal", ["--", "bash", ...bashArgs]);
    }
    if (existsSync("/usr/bin/konsole")) {
      return tryTerminal("/usr/bin/konsole", ["-e", "bash", ...bashArgs]);
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
  await waitForHealth();
  return true;
});

ipcMain.handle(
  "provider-key:set",
  async (
    _e,
    provider: string,
    key: string,
  ): Promise<
    | { ok: true; providerReady: true }
    | { ok: true; providerReady: false; hint: string }
    | { ok: false; error: string }
  > => {
    if (!["openai", "anthropic", "groq"].includes(provider)) {
      return { ok: false, error: "Unsupported provider." };
    }
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return { ok: false, error: "API key cannot be empty." };
    }
    const p = provider as "openai" | "anthropic" | "groq";
    const defs = defaultAliasModels(p);
    config.provider = provider;
    config.aliasSmartModel = defs.smart;
    config.aliasFastModel = defs.fast;
    config.aliasQualityModel = defs.quality;
    config.providerKeys = { ...config.providerKeys, [provider]: trimmedKey };
    await saveConfig();
    stopCompanion();
    await delay(750);
    startCompanion();
    const ready = await waitForHealthProviderReady(45000);
    if (ready) {
      return { ok: true, providerReady: true };
    }
    try {
      const res = await fetch(`http://127.0.0.1:${config.port}/health`);
      const j = (await res.json()) as CompanionHealthBody;
      if (j.providerConfigured === true && isSpectyraCompanionHealth(j)) {
        return { ok: true, providerReady: true };
      }
      if (!isSpectyraCompanionHealth(j)) {
        return {
          ok: true,
          providerReady: false,
          hint:
            `Something on port ${config.port} responded to /health but it is not the Spectyra Local Companion. ` +
            "Quit any dev server or other app using that port, then restart Spectyra.",
        };
      }
      return {
        ok: true,
        providerReady: false,
        hint:
          "The companion is running but does not see a provider API key yet. " +
            "If you pasted a key, try again after fully quitting Spectyra, or check that no other process is bound to the same port.",
      };
    } catch {
      return {
        ok: true,
        providerReady: false,
        hint: `Could not reach the companion on port ${config.port}. Restart Spectyra or check that the port is not blocked.`,
      };
    }
  },
);

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

/**
 * Switch active upstream provider without re-pasting a key (uses saved keys or env vars).
 * Resets smart/fast/quality alias models to defaults for that provider.
 */
ipcMain.handle(
  "provider:set-active",
  async (
    _e,
    provider: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!["openai", "anthropic", "groq"].includes(provider)) {
      return { ok: false, error: "Unsupported provider." };
    }
    if (!hasProviderCredential(provider)) {
      return {
        ok: false,
        error:
          "No API key for that provider. Save one in OpenClaw setup, or set the matching environment variable on your Mac.",
      };
    }
    const defs = defaultAliasModels(provider);
    config.provider = provider;
    config.aliasSmartModel = defs.smart;
    config.aliasFastModel = defs.fast;
    config.aliasQualityModel = defs.quality;
    await saveConfig();
    stopCompanion();
    await delay(750);
    startCompanion();
    const ready = await waitForHealthProviderReady(45000);
    if (!ready) {
      return {
        ok: false,
        error: "The companion did not report ready. Check the port, then try again or restart Spectyra.",
      };
    }
    return { ok: true };
  },
);

/** Clears disk-stored provider keys, rewrites provider-keys.json, and restarts the companion. */
ipcMain.handle("provider-keys:clear", async () => {
  config.providerKeys = {};
  await saveConfig();
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(PROVIDER_KEYS_FILE, "{}\n", "utf-8");
  } catch {
    /* ignore */
  }
  stopCompanion();
  await delay(750);
  startCompanion();
  await waitForHealth(20000);
  return true;
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

// ── OpenClaw Hub IPC ──────────────────────────────────────────────────────────

const PROFILES_FILE = path.join(CONFIG_DIR, "openclaw-profiles.json");
const TASKS_FILE = path.join(CONFIG_DIR, "openclaw-tasks.json");

async function readJsonFile<T>(p: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(p: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf-8");
}

function safeExecSync(cmd: string, args: string[], timeoutMs = 10000): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(cmd, args, { timeout: timeoutMs, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout: stdout.trim(), stderr: "" };
  } catch (err: any) {
    return { ok: false, stdout: (err.stdout ?? "").toString().trim(), stderr: (err.stderr ?? "").toString().trim() };
  }
}

ipcMain.handle("openclaw:config-path", async () => {
  const r = safeExecSync("openclaw", ["config", "path"]);
  return r.ok ? { ok: true, path: r.stdout } : { ok: false, error: r.stderr || "Could not get config path" };
});

ipcMain.handle("openclaw:doctor", async () => {
  const r = safeExecSync("openclaw", ["doctor"], 30000);
  return { ok: r.ok, output: r.ok ? r.stdout : r.stderr || r.stdout };
});

ipcMain.handle("openclaw:dashboard-check", async () => {
  try {
    const r = await fetch("http://localhost:3000", { signal: AbortSignal.timeout(3000) });
    return { reachable: r.ok || r.status < 500, status: r.status };
  } catch {
    return { reachable: false };
  }
});

ipcMain.handle("openclaw:gateway-check", async () => {
  try {
    const r = await fetch("http://localhost:18789/health", { signal: AbortSignal.timeout(3000) });
    return { reachable: r.ok, status: r.status };
  } catch {
    return { reachable: false };
  }
});

ipcMain.handle("openclaw:skills-search", async (_e, query: string) => {
  const r = safeExecSync("openclaw", ["skills", "search", query], 15000);
  if (!r.ok) return { ok: false, error: r.stderr || "Search failed", results: [] };
  const lines = r.stdout.split("\n").filter((l) => l.trim());
  const results = lines.map((line) => {
    const parts = line.split(/\s{2,}/).map((s) => s.trim());
    return { name: parts[0] || line.trim(), description: parts[1] || "", raw: line };
  });
  return { ok: true, results };
});

ipcMain.handle("openclaw:skills-installed", async () => {
  const r = safeExecSync("openclaw", ["skills", "list"]);
  if (!r.ok) return { ok: false, error: r.stderr || "Could not list skills", skills: [] };
  const lines = r.stdout.split("\n").filter((l) => l.trim());
  const skills = lines.map((line) => {
    const parts = line.split(/\s{2,}/).map((s) => s.trim());
    return { name: parts[0] || line.trim(), version: parts[1] || "", raw: line };
  });
  return { ok: true, skills };
});

ipcMain.handle("openclaw:skills-install", async (_e, name: string) => {
  const r = safeExecSync("openclaw", ["skills", "install", name], 60000);
  return r.ok ? { ok: true, output: r.stdout } : { ok: false, error: r.stderr || r.stdout || "Install failed" };
});

ipcMain.handle("openclaw:skills-update", async () => {
  const r = safeExecSync("openclaw", ["skills", "update"], 60000);
  return r.ok ? { ok: true, output: r.stdout } : { ok: false, error: r.stderr || r.stdout || "Update failed" };
});

ipcMain.handle("openclaw:open-path", async (_e, target: string) => {
  if (!target || target.includes("..")) return { ok: false };
  void shell.openPath(target);
  return { ok: true };
});

ipcMain.handle("openclaw:open-config", async () => {
  const r = safeExecSync("openclaw", ["config", "path"]);
  if (r.ok && r.stdout) {
    void shell.openPath(r.stdout);
    return { ok: true, path: r.stdout };
  }
  return { ok: false, error: "Could not find config path" };
});

ipcMain.handle("openclaw:open-logs", async () => {
  const logsDir = path.join(homedir(), ".openclaw", "logs");
  if (existsSync(logsDir)) {
    void shell.openPath(logsDir);
    return { ok: true, path: logsDir };
  }
  return { ok: false, error: "Logs directory not found" };
});

/** Assistant profiles — Spectyra-side presets stored locally. */
ipcMain.handle("spectyra:profiles-list", async () => {
  return readJsonFile<unknown[]>(PROFILES_FILE, []);
});

ipcMain.handle("spectyra:profiles-save", async (_e, profiles: unknown[]) => {
  await writeJsonFile(PROFILES_FILE, profiles);
  return true;
});

/** Task templates — Spectyra-side recurring job presets stored locally. */
ipcMain.handle("spectyra:tasks-list", async () => {
  return readJsonFile<unknown[]>(TASKS_FILE, []);
});

ipcMain.handle("spectyra:tasks-save", async (_e, tasks: unknown[]) => {
  await writeJsonFile(TASKS_FILE, tasks);
  return true;
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
