import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const COMPANION_DIR = join(homedir(), ".spectyra", "companion");
const STATE_FILE = join(COMPANION_DIR, "state.json");

export interface CompanionInstallState {
  installationId: string;
  createdAt: string;
  lastStartedAt: string;
  source: string;
}

export function ensureCompanionInstallState(): CompanionInstallState {
  mkdirSync(COMPANION_DIR, { recursive: true });
  const now = new Date().toISOString();
  if (existsSync(STATE_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as Partial<CompanionInstallState>;
      if (typeof raw.installationId === "string" && raw.installationId.length > 8) {
        const next: CompanionInstallState = {
          installationId: raw.installationId,
          createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
          lastStartedAt: now,
          source: typeof raw.source === "string" ? raw.source : "openclaw",
        };
        writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + "\n");
        return next;
      }
    } catch {
      /* write fresh */
    }
  }
  const fresh: CompanionInstallState = {
    installationId: randomUUID(),
    createdAt: now,
    lastStartedAt: now,
    source: "openclaw",
  };
  writeFileSync(STATE_FILE, JSON.stringify(fresh, null, 2) + "\n");
  return fresh;
}

export function readCompanionInstallState(): CompanionInstallState | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as Partial<CompanionInstallState>;
    if (typeof raw.installationId === "string" && raw.installationId.length > 8) {
      return {
        installationId: raw.installationId,
        createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
        lastStartedAt: typeof raw.lastStartedAt === "string" ? raw.lastStartedAt : new Date().toISOString(),
        source: typeof raw.source === "string" ? raw.source : "openclaw",
      };
    }
  } catch {
    /* */
  }
  return null;
}
