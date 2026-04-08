/**
 * Spectyra Local Companion CLI
 *
 * Commands:
 *   spectyra-companion           Start the companion server (default)
 *   spectyra-companion start     Start the companion server
 *   spectyra-companion setup     Interactive setup (account + provider key + OpenClaw config)
 *   spectyra-companion status    Check if companion is running
 *   spectyra-companion dashboard Open the local savings page in your browser
 *   spectyra-companion upgrade   Sign in (if needed) and open Stripe checkout (returns to local /dashboard)
 *   spectyra-companion account [web|cancel|keep|pause|resume|delete]
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { spectyraOpenClawModelDefinitions, trialBannerState } from "@spectyra/shared";
import { companionPackageVersion } from "./packageVersion.js";
import { listOpenClawProviderKeys } from "./openclawAuthFallback.js";
import {
  DESKTOP_CONFIG_DIR,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  emailFromAccessTokenJwt,
  getValidSupabaseAccessToken,
  loadDesktopConfig,
  saveDesktopConfig,
  saveSupabaseSession,
} from "./desktopSession.js";
import { DEFAULT_SPECTYRA_CLOUD_API_V1, DEFAULT_SPECTYRA_WEB_ORIGIN } from "./cloudDefaults.js";

const PROVIDER_KEYS_FILE = join(DESKTOP_CONFIG_DIR, "provider-keys.json");
const COMPANION_DIR = join(homedir(), ".spectyra", "companion");

function providerDisplayName(id: string): string {
  switch (id) {
    case "anthropic":
      return "Anthropic";
    case "groq":
      return "Groq";
    default:
      return "OpenAI";
  }
}

const SPECTYRA_API = process.env.SPECTYRA_API_URL?.trim() || DEFAULT_SPECTYRA_CLOUD_API_V1;
const WEB_ORIGIN = process.env.SPECTYRA_WEB_ORIGIN?.trim() || DEFAULT_SPECTYRA_WEB_ORIGIN;

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function ok(msg: string) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function info(msg: string) { console.log(`  ${CYAN}→${RESET} ${msg}`); }
function warn(msg: string) { console.log(`  ${YELLOW}!${RESET} ${msg}`); }

/** Supabase / HaveIBeenPwned style messages — user should pick another password and retry. */
function isPasswordRetryMessage(msg: string): boolean {
  const t = msg.toLowerCase();
  return (
    t.includes("weak") ||
    t.includes("easy to guess") ||
    t.includes("pwned") ||
    t.includes("breach") ||
    t.includes("common password") ||
    t.includes("hibp") ||
    t.includes("known to be") ||
    t.includes("leaked")
  );
}

function printSpectyraApiKeyCopyBlock(apiKey: string): void {
  console.log("");
  console.log(
    `  ${BOLD}Your Spectyra API key${RESET} — copy it now; it may not be shown again (also saved in ~/.spectyra/desktop/config.json):`,
  );
  console.log("");
  console.log(`  ${CYAN}${apiKey}${RESET}`);
  console.log("");
}

async function handleEnsureAccountAfterSignIn(
  accessToken: string,
  config: Record<string, unknown>,
  ensureBody: Record<string, unknown>,
): Promise<void> {
  try {
    const ensured = await postEnsureAccount(accessToken, ensureBody);
    if (ensured.api_key) {
      config.apiKey = ensured.api_key;
      ok("Spectyra org API key stored on this machine.");
      printSpectyraApiKeyCopyBlock(ensured.api_key);
    } else if (ensured.already_provisioned) {
      info(
        "Account already had an organization — the cloud API key is not shown again. " +
          "Add or copy a key in the Spectyra web app (Settings → API keys).",
      );
    }
    if (ensured.license_key) {
      config.licenseKey = ensured.license_key;
      ok("License key provisioned");
    }
    if (config.apiKey || config.licenseKey) saveDesktopConfig(config);

    if (!config.licenseKey) {
      try {
        const lkResp = await fetchJson(`${SPECTYRA_API}/license/generate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ device_name: "spectyra-companion-setup" }),
        });
        if (lkResp?.license_key) {
          config.licenseKey = lkResp.license_key;
          saveDesktopConfig(config);
          ok("License key provisioned");
        }
      } catch {
        /* optional */
      }
    }
  } catch (e) {
    warn(
      `Could not finish Spectyra account setup: ${e instanceof Error ? e.message : String(e)}. Check API URL or try again.`,
    );
  }
}

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

/** Idempotent org + API key (+ license) provisioning — works without visiting the website. */
async function postEnsureAccount(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{
  already_provisioned?: boolean;
  api_key?: string;
  license_key?: string | null;
  error?: string;
}> {
  const res = await fetch(`${SPECTYRA_API}/auth/ensure-account`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (data.error as string) || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data as {
    already_provisioned?: boolean;
    api_key?: string;
    license_key?: string | null;
  };
}

function emailFromSupabaseSessionInConfig(config: Record<string, unknown>): string | undefined {
  const s = config.supabaseSession as { access_token?: string } | undefined;
  return emailFromAccessTokenJwt(s?.access_token);
}

async function promptSignInForTokens(config: Record<string, unknown>): Promise<string | null> {
  const email = await ask("Email: ");
  const password = await ask("Password: ", true);
  const resp = await fetchJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp?.access_token) {
    warn(resp.error_description || resp.msg || "Sign-in failed");
    return null;
  }
  saveSupabaseSession(config, resp);
  return resp.access_token as string;
}

async function fetchBillingStatus(accessToken: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${SPECTYRA_API}/billing/status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

async function postBillingCheckout(accessToken: string): Promise<string | null> {
  const dc = loadDesktopConfig();
  const port = typeof dc.port === "number" && Number.isFinite(dc.port) ? dc.port : 4111;
  const localDash = `http://127.0.0.1:${port}/dashboard`;
  const useWebReturn = process.env.SPECTYRA_CHECKOUT_RETURN_WEB === "1";
  const success_url = useWebReturn ? `${WEB_ORIGIN}/usage?upgraded=true` : `${localDash}?upgraded=1`;
  const cancel_url = useWebReturn ? `${WEB_ORIGIN}/usage` : localDash;
  const res = await fetch(`${SPECTYRA_API}/billing/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      success_url,
      cancel_url,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { checkout_url?: string; error?: string };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.checkout_url || null;
}

async function postAccountCancelRenewal(accessToken: string): Promise<void> {
  const res = await fetch(`${SPECTYRA_API}/account/subscription/cancel-at-period-end`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; warnings?: string[] };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (data.warnings?.length) warn(data.warnings.join("; "));
}

async function postAccountKeep(accessToken: string): Promise<void> {
  const res = await fetch(`${SPECTYRA_API}/account/subscription/keep`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; warnings?: string[] };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (data.warnings?.length) warn(data.warnings.join("; "));
}

async function postAccountPause(accessToken: string): Promise<void> {
  const res = await fetch(`${SPECTYRA_API}/account/pause-service`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
}

async function postAccountResume(accessToken: string): Promise<void> {
  const res = await fetch(`${SPECTYRA_API}/account/resume-service`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
}

async function postAccountDelete(accessToken: string): Promise<void> {
  const res = await fetch(`${SPECTYRA_API}/account/delete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "DELETE_MY_ACCOUNT" }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
}

function openBrowserAccountBilling(): void {
  const url = `${WEB_ORIGIN.replace(/\/$/, "")}/billing`;
  openBrowser(url);
}

function printTrialBannerLine(accessToken: string): Promise<void> {
  return fetchBillingStatus(accessToken).then((st) => {
    const banner = trialBannerState({
      trialEndsAtIso: st.trial_ends_at as string | undefined,
      subscriptionStatus: st.subscription_status as string | undefined,
      subscriptionActive: st.subscription_active as boolean | undefined,
      platformExempt:
        !!(st.org_platform_exempt || st.platform_billing_exempt),
    });
    if (banner.severity === "none") return;
    console.log(`  ${CYAN}${banner.title}${RESET} — ${banner.detail}`);
  });
}

async function runUpgrade(): Promise<void> {
  console.log("");
  console.log(`${BOLD}Spectyra — Subscribe${RESET}`);
  console.log(`${DIM}  Secure Stripe checkout (opens in your browser); after payment you return to http://127.0.0.1:<port>/dashboard.${RESET}`);
  console.log("");
  const config = loadDesktopConfig();
  let token = await getValidSupabaseAccessToken(config);
  if (!token) {
    info("Sign in to your Spectyra account:");
    token = await promptSignInForTokens(config);
    if (!token) {
      process.exitCode = 1;
      return;
    }
  }
  try {
    await printTrialBannerLine(token);
    console.log("");
    const go = await ask("Open Stripe checkout in your browser? [Y/n] ");
    if (go.trim().toLowerCase().startsWith("n")) {
      info("Cancelled.");
      return;
    }
    const url = await postBillingCheckout(token);
    if (!url) {
      warn("No checkout URL returned. Is Stripe configured on the API?");
      process.exitCode = 1;
      return;
    }
    ok("Opening checkout…");
    openBrowser(url);
  } catch (e) {
    warn(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}

async function runAccount(sub?: string): Promise<void> {
  const config = loadDesktopConfig();
  let token = await getValidSupabaseAccessToken(config);
  if (!token) {
    info("Sign in to your Spectyra account:");
    token = await promptSignInForTokens(config);
    if (!token) {
      process.exitCode = 1;
      return;
    }
  }

  const action = (sub || "web").trim().toLowerCase();
  if (action === "web" || action === "open" || action === "") {
    console.log("");
    info(`Opening ${WEB_ORIGIN.replace(/\/$/, "")}/billing — cancel, pause, or delete your account there.`);
    openBrowserAccountBilling();
    return;
  }

  try {
    if (action === "cancel") {
      const go = await ask("Cancel auto-renew at end of current period? [y/N] ");
      if (!go.trim().toLowerCase().startsWith("y")) {
        info("Cancelled.");
        return;
      }
      await postAccountCancelRenewal(token);
      ok("Renewal cancelled (access continues until period end).");
    } else if (action === "keep") {
      await postAccountKeep(token);
      ok("Subscription will renew as usual.");
    } else if (action === "pause") {
      const go = await ask("Pause account (Stripe + 30d grace, then read-only)? [y/N] ");
      if (!go.trim().toLowerCase().startsWith("y")) {
        info("Cancelled.");
        return;
      }
      await postAccountPause(token);
      ok("Account pause applied.");
    } else if (action === "resume") {
      await postAccountResume(token);
      ok("Account reactivated.");
    } else if (action === "delete") {
      const go = await ask('Type DELETE to permanently delete your account (cannot be undone): ');
      if (go.trim() !== "DELETE") {
        info("Aborted.");
        return;
      }
      await postAccountDelete(token);
      ok("Account deleted. Local session may still be cached — sign out in apps if needed.");
    } else {
      console.error(`Unknown account action: ${action}`);
      console.log(`Use: web | cancel | keep | pause | resume | delete`);
      process.exitCode = 1;
    }
  } catch (e) {
    warn(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}

function loadProviderKeys(): Record<string, string> {
  if (!existsSync(PROVIDER_KEYS_FILE)) return {};
  try { return JSON.parse(readFileSync(PROVIDER_KEYS_FILE, "utf-8")); } catch { return {}; }
}

function saveProviderKeys(keys: Record<string, string>) {
  mkdirSync(DESKTOP_CONFIG_DIR, { recursive: true });
  writeFileSync(PROVIDER_KEYS_FILE, JSON.stringify(keys) + "\n");
}

// ── Setup command ──

async function runSetup() {
  console.log("");
  console.log(`${BOLD}Spectyra Local Companion — Setup${RESET}`);
  console.log(`${DIM}  Everything happens here in the terminal.${RESET}`);
  console.log("");

  const config = loadDesktopConfig();
  const existingKeys = loadProviderKeys();

  // ── 1. Account ──
  console.log(`${BOLD}1. Spectyra account${RESET}`);
  console.log(`${DIM}  Set up your account for the optimization and savings dashboard.${RESET}`);
  console.log("");

  let signedIn = false;

  if (config.apiKey && config.apiKey !== "null") {
    ok("Existing session found — account step skipped (Spectyra API key already in config).");
    const sessEmail = emailFromSupabaseSessionInConfig(config);
    if (sessEmail && config.accountEmail !== sessEmail) {
      config.accountEmail = sessEmail;
      saveDesktopConfig(config);
    }
    const displayEmail =
      typeof config.accountEmail === "string" && config.accountEmail.trim()
        ? config.accountEmail.trim()
        : sessEmail;
    if (displayEmail) {
      ok(`Spectyra account email: ${displayEmail}`);
    } else {
      info(
        "Add accountEmail to config or remove apiKey and re-run setup to link an email. Or switch accounts: delete apiKey and supabaseSession in ~/.spectyra/desktop/config.json",
      );
    }
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
          config.accountEmail = email.trim();
          saveSupabaseSession(config, resp);
          await handleEnsureAccountAfterSignIn(resp.access_token as string, config, {});
        } else {
          warn(resp.error_description || resp.msg || "Sign-in failed");
        }
      } catch {
        warn("Could not reach Spectyra. Sign in later at spectyra.com");
      }
    } else {
      console.log("");
      const email = (await ask("Email: ")).trim();
      if (!email.includes("@")) {
        warn("Enter a valid email address, then run setup again.");
      } else {
        const orgLine = await ask("Organization name (optional — Enter uses a name from your email): ");
        const orgNameTrim = orgLine.trim();
        const ensureBody: Record<string, unknown> =
          orgNameTrim.length > 0 ? { org_name: orgNameTrim } : {};

        let signupDone = false;
        while (!signupDone) {
          const password = await ask("Password (min 8 chars): ", true);
          if (password.length < 8) {
            warn("Password must be at least 8 characters.");
            const shortRetry = await ask("Try a different password? [Y/n] ");
            if (shortRetry.trim().toLowerCase().startsWith("n")) break;
            continue;
          }

          info("Creating account...");
          try {
            const signupResp = await fetchJson(`${SUPABASE_URL}/auth/v1/signup`, {
              method: "POST",
              headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });

            const errText = String(
              signupResp.msg || signupResp.error_description || signupResp.message || "",
            );

            if (errText && !signupResp.access_token && !signupResp.id) {
              warn(errText);
              if (/already (registered|exists)|user already|duplicate/i.test(errText)) {
                info(`If this is your email, run ${CYAN}spectyra-companion setup${RESET} again and choose “Have a Spectyra account? [y]” to sign in.`);
                break;
              }
              if (isPasswordRetryMessage(errText)) {
                const again = await ask("Choose a stronger password? [Y/n] ");
                if (again.trim().toLowerCase().startsWith("n")) break;
                continue;
              }
              const again = await ask("Try a different password? [Y/n] ");
              if (again.trim().toLowerCase().startsWith("n")) break;
              continue;
            }

            if (signupResp.msg && !signupResp.id && !signupResp.access_token && !errText) {
              warn(String(signupResp.msg));
            }

            let token = (signupResp.access_token as string | undefined) || null;
            let grantForSession: Record<string, unknown> = signupResp;

            if (!token && signupResp.id) {
              try {
                const acRes = await fetch(`${SPECTYRA_API}/auth/auto-confirm`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
                if (!acRes.ok) {
                  const detail = await acRes.text().catch(() => "");
                  warn(
                    `Email confirmation helper failed (${acRes.status}). ` +
                      `Check Spectyra API deployment and Supabase service role. ${detail.slice(0, 120)}`,
                  );
                }
              } catch (e) {
                warn(`auto-confirm request failed: ${e instanceof Error ? e.message : String(e)}`);
              }

              await new Promise((r) => setTimeout(r, 1000));

              const loginResp = await fetchJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: "POST",
                headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
              });
              grantForSession = loginResp;
              token = (loginResp.access_token as string | undefined) || null;
            }

            if (token) {
              ok(`Account created for ${email}`);
              signedIn = true;
              config.accountEmail = email;
              saveSupabaseSession(config, grantForSession);
              await handleEnsureAccountAfterSignIn(token, config, ensureBody);
              signupDone = true;
            } else {
              warn(
                "Could not create a session after sign-up (email confirmation or sign-in failed). " +
                  `You can also register at ${WEB_ORIGIN}`,
              );
              const again = await ask("Try a different password? [Y/n] ");
              if (again.trim().toLowerCase().startsWith("n")) break;
            }
          } catch {
            warn("Could not reach Spectyra.");
            break;
          }
        }
      }
    }
  }

  if (!signedIn) {
    console.log("");
    warn("Account setup is not complete — provider keys and OpenClaw were not changed.");
    console.log(
      `${DIM}  Run ${CYAN}spectyra-companion setup${RESET}${DIM} again after fixing email/password above.${RESET}`,
    );
    console.log("");
    process.exitCode = 1;
    return;
  }

  if (signedIn) {
    let cfg = loadDesktopConfig();
    if (!cfg.accountEmail) {
      const em =
        emailFromSupabaseSessionInConfig(cfg) ||
        emailFromAccessTokenJwt((cfg.supabaseSession as { access_token?: string } | undefined)?.access_token);
      if (em) {
        cfg.accountEmail = em;
        saveDesktopConfig(cfg);
        cfg = loadDesktopConfig();
      }
    }
    if (typeof cfg.accountEmail === "string" && cfg.accountEmail.trim()) {
      ok(`Account email on file: ${cfg.accountEmail.trim()}`);
    }
    if (!cfg.apiKey || cfg.apiKey === "null") {
      warn(
        "No Spectyra org API key in config — input savings stay in preview until you add a key (spectyra.ai → Settings → API keys) or complete setup on a fresh account.",
      );
    } else {
      ok("Spectyra org API key is stored — billing and trials apply to this org.");
    }
    const t = await getValidSupabaseAccessToken(cfg);
    if (t) {
      try {
        await printTrialBannerLine(t);
      } catch {
        /* billing optional offline */
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
    const fromOpenClaw = listOpenClawProviderKeys();

    if (fromOpenClaw.length === 1) {
      const { provider, key } = fromOpenClaw[0];
      console.log(
        `${DIM}  Found a ${providerDisplayName(provider)} API key in your OpenClaw config (~/.openclaw).${RESET}`,
      );
      const use = await ask("  Use it for Spectyra (key stays on this machine only)? [Y/n] ");
      if (!use.trim() || use.toLowerCase().startsWith("y")) {
        const keys = { ...existingKeys, [provider]: key };
        saveProviderKeys(keys);
        config.provider = provider;
        config.port = config.port || 4111;
        config.providerKeys = keys;
        saveDesktopConfig(config);
        ok(`${providerDisplayName(provider)} key saved (from OpenClaw)`);
        providerSet = true;
      }
    } else if (fromOpenClaw.length > 1) {
      console.log(`${DIM}  Found API keys in your OpenClaw config for:${RESET}`);
      fromOpenClaw.forEach((e, i) => {
        console.log(`    ${i + 1}) ${providerDisplayName(e.provider)}`);
      });
      const manualIdx = fromOpenClaw.length + 1;
      console.log(`    ${manualIdx}) Enter a key manually instead`);
      console.log("");
      const pick = await ask(`  Which should Spectyra use for upstream calls? [1-${manualIdx}] `);
      const n = parseInt(pick.trim(), 10);
      if (n >= 1 && n <= fromOpenClaw.length) {
        const { provider, key } = fromOpenClaw[n - 1];
        const keys = { ...existingKeys, [provider]: key };
        saveProviderKeys(keys);
        config.provider = provider;
        config.port = config.port || 4111;
        config.providerKeys = keys;
        saveDesktopConfig(config);
        ok(`${providerDisplayName(provider)} key saved (from OpenClaw)`);
        providerSet = true;
      }
    }

    if (!providerSet) {
      console.log("  Which provider?");
      console.log("    1) OpenAI");
      console.log("    2) Anthropic");
      console.log("    3) Groq");
      console.log("");
      const choice = await ask("Choice [1/2/3]: ");

      let provider: string;
      switch (choice.trim()) {
        case "2":
          provider = "anthropic";
          break;
        case "3":
          provider = "groq";
          break;
        default:
          provider = "openai";
          break;
      }

      console.log("");
      const key = await ask(`Paste your ${provider} API key: `, true);

      if (key.trim()) {
        const keys = { ...existingKeys, [provider]: key.trim() };
        saveProviderKeys(keys);
        config.provider = provider;
        config.port = config.port || 4111;
        config.providerKeys = keys;
        saveDesktopConfig(config);
        ok(`${provider} key saved`);
        providerSet = true;
      } else {
        warn("No key entered.");
      }
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
      models: spectyraOpenClawModelDefinitions(),
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
  const config = loadDesktopConfig();
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
  const config = loadDesktopConfig();
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

  const config = loadDesktopConfig();
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
const cmdArg = positional[1];

function runHelp(): void {
  console.log("");
  console.log("Spectyra Local Companion");
  console.log("");
  console.log("Usage: spectyra-companion [options] [command]");
  console.log("");
  console.log("Options:");
  console.log("  --version, -V  Print package version and exit");
  console.log("  --open, -o     With start: open the local savings page in your browser");
  console.log("");
  console.log("Commands:");
  console.log("  setup        Interactive setup (account + provider key + OpenClaw config)");
  console.log("  start        Start the companion server (default)");
  console.log("  dashboard    Open local savings in your browser (companion must be running)");
  console.log("  status       Check if companion is running");
  console.log("  upgrade      Sign in (if needed) and open Stripe checkout in your browser");
  console.log("");
}

if (cmd === "--help" || cmd === "-h") {
  runHelp();
} else if (cmd === "--version" || cmd === "-V") {
  console.log(companionPackageVersion());
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
    case "upgrade":
      if (openAfterStart) warn("--open applies to start only");
      runUpgrade().catch((e) => { console.error(e); process.exit(1); });
      break;
    case "account":
      if (openAfterStart) warn("--open applies to start only");
      runAccount(cmdArg).catch((e) => { console.error(e); process.exit(1); });
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
