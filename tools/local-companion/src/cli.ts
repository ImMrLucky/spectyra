/**
 * Spectyra Local Companion CLI
 *
 * Commands:
 *   spectyra-companion           Start the companion server (default)
 *   spectyra-companion start     Start the companion server
 *   spectyra-companion setup     Interactive setup (account + provider key + OpenClaw config)
 *   spectyra-companion status    Check if companion is running
 *   spectyra-companion dashboard Open the local savings page in your browser
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const CONFIG_DIR = join(homedir(), ".spectyra", "desktop");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const PROVIDER_KEYS_FILE = join(CONFIG_DIR, "provider-keys.json");
const COMPANION_DIR = join(homedir(), ".spectyra", "companion");

const SPECTYRA_API = "https://spectyra.up.railway.app/v1";
const SUPABASE_URL = "https://jajqvceuenqeblbgsigt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphanF2Y2V1ZW5xZWJsYmdzaWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDI4MDgsImV4cCI6MjA4NDk3ODgwOH0.IJ7CSyX-_-lahfaOzM9U5EIpR6tcW-GhiMZeCY_efno";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function ok(msg: string) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function info(msg: string) { console.log(`  ${CYAN}→${RESET} ${msg}`); }
function warn(msg: string) { console.log(`  ${YELLOW}!${RESET} ${msg}`); }

function ask(prompt: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    if (hidden && process.stdin.isTTY) {
      process.stdout.write(`  ${prompt}`);
      const stdin = process.stdin;
      stdin.setRawMode?.(true);
      let buf = "";
      const onData = (ch: Buffer) => {
        const c = ch.toString();
        if (c === "\n" || c === "\r") {
          stdin.setRawMode?.(false);
          stdin.removeListener("data", onData);
          rl.close();
          process.stdout.write("\n");
          resolve(buf);
        } else if (c === "\x7f" || c === "\b") {
          buf = buf.slice(0, -1);
        } else if (c === "\x03") {
          process.exit(1);
        } else {
          buf += c;
        }
      };
      stdin.on("data", onData);
      stdin.resume();
    } else {
      rl.question(`  ${prompt}`, (answer) => { rl.close(); resolve(answer); });
    }
  });
}

async function fetchJson(url: string, opts: RequestInit): Promise<any> {
  const res = await fetch(url, opts);
  return res.json();
}

function loadLocalConfig(): Record<string, unknown> {
  if (!existsSync(CONFIG_FILE)) return {};
  try { return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")); } catch { return {}; }
}

function saveLocalConfig(config: Record<string, unknown>) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

function loadProviderKeys(): Record<string, string> {
  if (!existsSync(PROVIDER_KEYS_FILE)) return {};
  try { return JSON.parse(readFileSync(PROVIDER_KEYS_FILE, "utf-8")); } catch { return {}; }
}

function saveProviderKeys(keys: Record<string, string>) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(PROVIDER_KEYS_FILE, JSON.stringify(keys) + "\n");
}

// ── Setup command ──

async function runSetup() {
  console.log("");
  console.log(`${BOLD}Spectyra Local Companion — Setup${RESET}`);
  console.log(`${DIM}  Everything happens here in the terminal.${RESET}`);
  console.log("");

  const config = loadLocalConfig();
  const existingKeys = loadProviderKeys();

  // ── 1. Account ──
  console.log(`${BOLD}1. Spectyra account${RESET}`);
  console.log(`${DIM}  Create an account here or sign in — no need to open spectyra.ai (optional: register in a browser first).${RESET}`);
  console.log("");

  let signedIn = false;

  if (config.apiKey && config.apiKey !== "null") {
    ok("Existing session found");
    signedIn = true;
  }

  if (!signedIn) {
    const hasAccount = await ask("Have a Spectyra account? [y/N] ");

    if (hasAccount.toLowerCase().startsWith("y")) {
      console.log("");
      const email = await ask("Email: ");
      const password = await ask("Password: ", true);

      info("Signing in...");
      try {
        const resp = await fetchJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (resp.access_token) {
          ok(`Signed in as ${email}`);
          signedIn = true;
          try {
            const bootstrap = await fetchJson(`${SPECTYRA_API}/auth/bootstrap`, {
              method: "POST",
              headers: { Authorization: `Bearer ${resp.access_token}`, "Content-Type": "application/json" },
              body: "{}",
            });
            if (bootstrap?.api_key) {
              config.apiKey = bootstrap.api_key;
            }
            if (bootstrap?.license_key) {
              config.licenseKey = bootstrap.license_key;
              ok("License key provisioned");
            }
            if (config.apiKey || config.licenseKey) saveLocalConfig(config);

            if (!config.licenseKey) {
              try {
                const lkResp = await fetchJson(`${SPECTYRA_API}/license/generate`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${resp.access_token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ device_name: "spectyra-companion-setup" }),
                });
                if (lkResp?.license_key) {
                  config.licenseKey = lkResp.license_key;
                  saveLocalConfig(config);
                  ok("License key provisioned");
                }
              } catch { /* license generation optional */ }
            }
          } catch { /* bootstrap optional */ }
        } else {
          warn(resp.error_description || resp.msg || "Sign-in failed");
        }
      } catch {
        warn("Could not reach Spectyra. Sign in later at spectyra.com");
      }
    } else {
      console.log("");
      const email = await ask("Email: ");
      const password = await ask("Password (min 8 chars): ", true);
      const orgName = await ask("Organization name: ");

      info("Creating account...");
      try {
        const signupResp = await fetchJson(`${SUPABASE_URL}/auth/v1/signup`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        let token = signupResp.access_token || null;

        if (!token && signupResp.id) {
          try {
            await fetch(`${SPECTYRA_API}/auth/auto-confirm`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
          } catch { /* optional */ }

          await new Promise((r) => setTimeout(r, 1000));

          const loginResp = await fetchJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: "POST",
            headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          token = loginResp.access_token || null;
        }

        if (token) {
          ok(`Account created for ${email}`);
          signedIn = true;
          try {
            const bootstrap = await fetchJson(`${SPECTYRA_API}/auth/bootstrap`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ org_name: orgName.trim() }),
            });
            if (bootstrap?.api_key) {
              config.apiKey = bootstrap.api_key;
            }
            if (bootstrap?.license_key) {
              config.licenseKey = bootstrap.license_key;
              ok("License key provisioned");
            }
            if (config.apiKey || config.licenseKey) saveLocalConfig(config);
          } catch { /* bootstrap optional */ }
        } else {
          warn("Could not create account. Sign up later at spectyra.com");
        }
      } catch {
        warn("Could not reach Spectyra.");
      }
    }
  }
  console.log("");

  // ── 2. Provider key ──
  console.log(`${BOLD}2. AI provider key${RESET}`);
  console.log(`${DIM}  Your key stays on this machine — never sent to Spectyra.${RESET}`);
  console.log("");

  let providerSet = false;
  const hasKey = Object.values(existingKeys).some((v) => !!v);

  if (hasKey) {
    ok("Provider key already configured");
    providerSet = true;
  } else {
    console.log("  Which provider?");
    console.log("    1) OpenAI");
    console.log("    2) Anthropic");
    console.log("    3) Groq");
    console.log("");
    const choice = await ask("Choice [1/2/3]: ");

    let provider: string;
    switch (choice.trim()) {
      case "2": provider = "anthropic"; break;
      case "3": provider = "groq"; break;
      default: provider = "openai"; break;
    }

    console.log("");
    const key = await ask(`Paste your ${provider} API key: `, true);

    if (key.trim()) {
      const keys = { ...existingKeys, [provider]: key.trim() };
      saveProviderKeys(keys);
      config.provider = provider;
      config.port = config.port || 4111;
      config.providerKeys = keys;
      saveLocalConfig(config);
      ok(`${provider} key saved`);
      providerSet = true;
    } else {
      warn("No key entered.");
    }
  }
  console.log("");

  // ── 3. OpenClaw config ──
  console.log(`${BOLD}3. OpenClaw integration${RESET}`);
  console.log("");

  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync("which", ["openclaw"], { stdio: "ignore" });

    info("Configuring OpenClaw to use Spectyra models...");

    const providerJson = JSON.stringify({
      baseUrl: "http://127.0.0.1:4111/v1",
      apiKey: "SPECTYRA_LOCAL",
      api: "openai-completions",
      models: [
        { id: "spectyra/smart", name: "Spectyra Smart", contextWindow: 128000, maxTokens: 8192 },
        { id: "spectyra/fast", name: "Spectyra Fast", contextWindow: 128000, maxTokens: 8192 },
        { id: "spectyra/quality", name: "Spectyra Quality", contextWindow: 200000, maxTokens: 16384 },
      ],
    });

    try {
      execFileSync("openclaw", ["config", "set", "models.providers.spectyra", providerJson, "--strict-json"], {
        stdio: "pipe",
      });
      ok("Spectyra provider added to OpenClaw config");
    } catch {
      warn("Could not auto-configure OpenClaw. You may need to add the provider manually.");
    }

    try {
      execFileSync("openclaw", ["config", "set", "agents.defaults.model.primary", '"spectyra/smart"', "--strict-json"], {
        stdio: "pipe",
      });
      ok("Default model set to spectyra/smart");
    } catch {
      warn("Could not set default model.");
    }
  } catch {
    info("OpenClaw not found — skipping auto-config.");
    console.log(`${DIM}  Install OpenClaw: curl -fsSL https://openclaw.ai/install.sh | bash${RESET}`);
  }
  console.log("");

  // ── Done ──
  console.log(`${BOLD}────────────────────────────────${RESET}`);
  console.log("");
  if (providerSet) {
    ok("Setup complete!");
    console.log("");
    console.log(`  Start + open savings: ${CYAN}spectyra-companion start --open${RESET}`);
    console.log(`  Or start only:        ${CYAN}spectyra-companion start${RESET}`);
    console.log(`  Open savings later:   ${CYAN}spectyra-companion dashboard${RESET}`);
    console.log(`  Then use OpenClaw:    ${CYAN}openclaw chat${RESET}`);
  } else {
    warn("Add a provider key, then run: spectyra-companion setup");
  }
  console.log("");
}

// ── Status command ──

async function runStatus() {
  const port = process.env.SPECTYRA_PORT || "4111";
  const url = `http://127.0.0.1:${port}/health`;
  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json() as Record<string, unknown>;
      ok(`Companion running on port ${port}`);
      console.log(`  Run mode:  ${data.runMode || "on"}`);
      console.log(`  Provider:  ${data.provider || "unknown"}`);
      console.log(`  Savings:   ${CYAN}http://127.0.0.1:${port}/dashboard${RESET}`);
    } else {
      warn(`Companion responded with status ${resp.status}`);
    }
  } catch {
    warn(`Companion not running (checked port ${port})`);
  }
}

function resolvedPort(): string {
  const config = loadLocalConfig();
  return process.env.SPECTYRA_PORT || String(config.port || 4111);
}

function openBrowser(url: string): void {
  const platform = process.platform;
  try {
    if (platform === "darwin") execFileSync("open", [url], { stdio: "ignore" });
    else if (platform === "win32") execFileSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
    else execFileSync("xdg-open", [url], { stdio: "ignore" });
  } catch {
    warn(`Could not open a browser. Visit: ${url}`);
  }
}

async function waitForCompanionHealth(port: string, timeoutMs = 15000): Promise<boolean> {
  const url = `http://127.0.0.1:${port}/health`;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("not ok");
      const j = (await r.json()) as { service?: string; status?: string };
      if (j.service === "spectyra-local-companion" && j.status === "ok") return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function runOpenDashboard(): Promise<void> {
  const port = resolvedPort();
  const url = `http://127.0.0.1:${port}/dashboard`;
  const healthy = await waitForCompanionHealth(port, 2000);
  if (!healthy) {
    warn(`Companion not responding on port ${port}`);
    console.log(`${DIM}  Start it with: spectyra-companion start${RESET}`);
    process.exitCode = 1;
    return;
  }
  openBrowser(url);
  ok(`Opened ${url}`);
}

// ── Start command ──

function needsSetup(): boolean {
  const keys = loadProviderKeys();
  const config = loadLocalConfig();
  const hasKey = Object.values(keys).some((v) => !!v);
  const hasInlineKey = config.providerKeys && typeof config.providerKeys === "object" &&
    Object.values(config.providerKeys as Record<string, string>).some((v) => !!v);
  return !hasKey && !hasInlineKey;
}

async function runStart(openDashboard: boolean) {
  if (needsSetup()) {
    console.log("");
    console.log(`${BOLD}First time?${RESET} Let's get you set up.`);
    console.log(`${DIM}  No provider key found — running guided setup first.${RESET}`);
    console.log("");
    await runSetup();
    if (needsSetup()) {
      warn("Setup incomplete — no provider key configured. Start aborted.");
      console.log(`${DIM}  Run ${CYAN}spectyra-companion setup${RESET}${DIM} when ready.${RESET}`);
      process.exitCode = 1;
      return;
    }
    console.log("");
    info("Setup done. Starting companion...");
    console.log("");
  }

  const config = loadLocalConfig();
  const provider = (config.provider as string) || "openai";

  if (!process.env.SPECTYRA_PROVIDER) process.env.SPECTYRA_PROVIDER = provider;
  if (!process.env.SPECTYRA_PORT) process.env.SPECTYRA_PORT = String(config.port || 4111);
  if (!process.env.SPECTYRA_BIND_HOST) process.env.SPECTYRA_BIND_HOST = "127.0.0.1";
  if (!process.env.SPECTYRA_RUN_MODE) process.env.SPECTYRA_RUN_MODE = "on";
  if (!process.env.SPECTYRA_TELEMETRY) process.env.SPECTYRA_TELEMETRY = "local";
  if (!process.env.SPECTYRA_PROVIDER_KEYS_FILE && existsSync(PROVIDER_KEYS_FILE)) {
    process.env.SPECTYRA_PROVIDER_KEYS_FILE = PROVIDER_KEYS_FILE;
  }
  if (!process.env.SPECTYRA_LICENSE_KEY && config.licenseKey) {
    process.env.SPECTYRA_LICENSE_KEY = String(config.licenseKey);
  }

  mkdirSync(COMPANION_DIR, { recursive: true });

  await import("./companion.js");

  if (openDashboard) {
    const port = process.env.SPECTYRA_PORT || "4111";
    const okHealth = await waitForCompanionHealth(port, 15000);
    if (okHealth) {
      openBrowser(`http://127.0.0.1:${port}/dashboard`);
      ok(`Opened http://127.0.0.1:${port}/dashboard`);
    } else {
      warn("Companion did not become healthy in time — open /dashboard manually when ready.");
    }
  }
}

// ── Main ──

function parseCliArgs(argv: string[]): { positional: string[]; openAfterStart: boolean } {
  let openAfterStart = false;
  const positional: string[] = [];
  for (const a of argv) {
    if (a === "--open" || a === "-o") openAfterStart = true;
    else positional.push(a);
  }
  return { positional, openAfterStart };
}

const { positional, openAfterStart } = parseCliArgs(process.argv.slice(2));
const cmd = positional[0];

function runHelp(): void {
  console.log("");
  console.log("Spectyra Local Companion");
  console.log("");
  console.log("Usage: spectyra-companion [options] [command]");
  console.log("");
  console.log("Options:");
  console.log("  --open, -o   With start: open the local savings page in your browser");
  console.log("");
  console.log("Commands:");
  console.log("  setup        Interactive setup (account + provider key + OpenClaw config)");
  console.log("  start        Start the companion server (default)");
  console.log("  dashboard    Open local savings in your browser (companion must be running)");
  console.log("  status       Check if companion is running");
  console.log("");
}

if (cmd === "--help" || cmd === "-h") {
  runHelp();
} else if (!cmd) {
  runStart(openAfterStart).catch((e) => { console.error(e); process.exit(1); });
} else {
  switch (cmd) {
    case "setup":
      if (openAfterStart) warn("--open applies to start only");
      runSetup().catch((e) => { console.error(e); process.exit(1); });
      break;
    case "status":
      if (openAfterStart) warn("--open applies to start only");
      runStatus().catch((e) => { console.error(e); process.exit(1); });
      break;
    case "dashboard":
      if (openAfterStart) warn("--open applies to start only");
      runOpenDashboard().catch((e) => { console.error(e); process.exit(1); });
      break;
    case "start":
      runStart(openAfterStart).catch((e) => { console.error(e); process.exit(1); });
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      runHelp();
      process.exit(1);
  }
}
