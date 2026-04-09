/**
 * Shared Supabase session + ~/.spectyra/desktop/config.json helpers for CLI and companion.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DESKTOP_CONFIG_DIR = join(homedir(), ".spectyra", "desktop");
export const DESKTOP_CONFIG_FILE = join(DESKTOP_CONFIG_DIR, "config.json");

export const SUPABASE_URL = "https://jajqvceuenqeblbgsigt.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphanF2Y2V1ZW5xZWJsYmdzaWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDI4MDgsImV4cCI6MjA4NDk3ODgwOH0.IJ7CSyX-_-lahfaOzM9U5EIpR6tcW-GhiMZeCY_efno";

type SupabaseSessionPersisted = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
};

export function loadDesktopConfig(): Record<string, unknown> {
  if (!existsSync(DESKTOP_CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(DESKTOP_CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function saveDesktopConfig(config: Record<string, unknown>): void {
  mkdirSync(DESKTOP_CONFIG_DIR, { recursive: true });
  writeFileSync(DESKTOP_CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

export function saveSupabaseSession(config: Record<string, unknown>, tokenResp: Record<string, unknown>): void {
  const at = tokenResp.access_token as string | undefined;
  if (!at) return;
  const expiresIn = typeof tokenResp.expires_in === "number" ? tokenResp.expires_in : 3600;
  const sess: SupabaseSessionPersisted = {
    access_token: at,
    refresh_token: tokenResp.refresh_token as string | undefined,
    expires_at: Date.now() + expiresIn * 1000 - 30_000,
  };
  config.supabaseSession = sess;
  saveDesktopConfig(config);
}

async function fetchJson(url: string, opts: RequestInit): Promise<any> {
  const res = await fetch(url, opts);
  return res.json();
}

export async function refreshSupabaseSession(config: Record<string, unknown>): Promise<string | null> {
  const s = config.supabaseSession as SupabaseSessionPersisted | undefined;
  if (!s?.refresh_token) return null;
  const resp = await fetchJson(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  if (!resp?.access_token) return null;
  saveSupabaseSession(config, resp);
  return resp.access_token as string;
}

export async function getValidSupabaseAccessToken(config: Record<string, unknown>): Promise<string | null> {
  const s = config.supabaseSession as SupabaseSessionPersisted | undefined;
  if (s?.access_token && s.expires_at > Date.now()) return s.access_token;
  return refreshSupabaseSession(config);
}

/**
 * If `~/.spectyra/desktop/config.json` has a Supabase session whose access token is expired
 * but `refresh_token` is still valid, exchange it and write the new tokens to disk.
 *
 * Call this before reporting `spectyraAccountLinked` (health/config) so users are not stuck
 * “unlinked” until they re-run setup. No-op when session is already valid or absent.
 */
export async function ensureDesktopSessionRefreshed(): Promise<void> {
  await getValidSupabaseAccessToken(loadDesktopConfig());
}

/** Decode email claim from a Supabase JWT (UX only; not cryptographically verified here). */
export function emailFromAccessTokenJwt(accessToken: string | undefined): string | undefined {
  if (!accessToken || typeof accessToken !== "string") return undefined;
  const part = accessToken.split(".")[1];
  if (!part) return undefined;
  for (const dec of [
    () => Buffer.from(part, "base64url").toString("utf8"),
    () => Buffer.from(part, "base64").toString("utf8"),
  ]) {
    try {
      const payload = JSON.parse(dec()) as { email?: string };
      if (typeof payload.email === "string") return payload.email;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

/**
 * Spectyra “account linked” for local savings: valid Supabase session + Spectyra org API key in config.
 * Provider LLM keys are separate.
 */
export function readSpectyraAccountGate(dc: Record<string, unknown>): {
  linked: boolean;
  email?: string;
  apiKey?: string;
} {
  const apiKey =
    typeof dc.apiKey === "string" && dc.apiKey.trim().length > 0 && dc.apiKey !== "null"
      ? dc.apiKey.trim()
      : undefined;
  const sess = dc.supabaseSession as SupabaseSessionPersisted | undefined;
  const sessionOk = Boolean(
    sess?.access_token && (typeof sess.expires_at !== "number" || sess.expires_at > Date.now()),
  );
  const linked = Boolean(apiKey && sessionOk);
  let email: string | undefined;
  if (typeof dc.accountEmail === "string" && dc.accountEmail.trim().length > 0) {
    email = dc.accountEmail.trim();
  } else {
    email = emailFromAccessTokenJwt(sess?.access_token);
  }
  return { linked, email, apiKey };
}
