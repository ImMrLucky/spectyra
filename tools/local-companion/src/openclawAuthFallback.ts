/**
 * When users configure OpenAI (etc.) only inside OpenClaw, keys live under
 * ~/.openclaw/.../auth-profiles.json — not in Spectyra's provider-keys.json.
 * Reuse those credentials for the local companion so OpenClaw → Spectyra works
 * without a second paste step.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type OpenClawAuthProvider = "openai" | "anthropic" | "groq";

function openClawStateRoot(): string {
  const d = process.env.OPENCLAW_STATE_DIR?.trim();
  if (d) return d;
  return join(homedir(), ".openclaw");
}

function unwrapAuthProfilesPayload(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (o.profiles && typeof o.profiles === "object" && !Array.isArray(o.profiles)) {
    return o.profiles as Record<string, unknown>;
  }
  return o;
}

/** Exported for unit tests — parses one auth-profiles.json body. */
export function extractApiKeyFromAuthProfilesJson(raw: unknown, want: OpenClawAuthProvider): string | undefined {
  const profiles = unwrapAuthProfilesPayload(raw);
  if (!profiles) return undefined;
  for (const [id, prof] of Object.entries(profiles)) {
    if (id === "version" || typeof prof !== "object" || !prof) continue;
    const p = prof as Record<string, unknown>;
    const provider = String(p.provider ?? "").toLowerCase();
    if (provider !== want) continue;
    const typ = String(p.type ?? "").toLowerCase();
    if (typ && typ !== "api_key") continue;
    const k = p.key ?? p.token ?? p.apiKey;
    if (typeof k === "string" && k.trim()) return k.trim();
  }
  return undefined;
}

function tryReadAuthFile(filePath: string, want: OpenClawAuthProvider): string | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
    return extractApiKeyFromAuthProfilesJson(raw, want);
  } catch {
    return undefined;
  }
}

/**
 * Best-effort: find an API key OpenClaw stored for `want`, reading the standard
 * on-disk layout. No network; local files only.
 */
export function readOpenClawProviderKey(want: OpenClawAuthProvider): string | undefined {
  const root = openClawStateRoot();

  const legacy = tryReadAuthFile(join(root, "auth-profiles.json"), want);
  if (legacy) return legacy;

  const agentsDir = join(root, "agents");
  if (!existsSync(agentsDir)) return undefined;

  let names: string[];
  try {
    names = readdirSync(agentsDir);
  } catch {
    return undefined;
  }

  names.sort();
  for (const name of names) {
    const agentDir = join(agentsDir, name);
    try {
      if (!statSync(agentDir).isDirectory()) continue;
    } catch {
      continue;
    }
    const k = tryReadAuthFile(join(agentDir, "agent", "auth-profiles.json"), want);
    if (k) return k;
  }

  return undefined;
}
