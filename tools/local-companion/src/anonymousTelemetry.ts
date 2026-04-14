import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { companionPackageVersion } from "./packageVersion.js";
import { readCompanionInstallState, type CompanionInstallState } from "./companionState.js";
import { fetchSpectyraV1 } from "./spectyraCloudFetch.js";

const FIRST_OPT_FLAG = join(homedir(), ".spectyra", "companion", "first_optimization_emitted");
const OPT_EVENT_DEBOUNCE_MS = 60_000;

let lastOptimizationPerfAt = 0;

export function sendAnonymousPing(state?: CompanionInstallState | null): void {
  void sendAnonymousPingAsync(state);
}

async function sendAnonymousPingAsync(state?: CompanionInstallState | null): Promise<void> {
  try {
    const st = state ?? readCompanionInstallState();
    if (!st) return;
    await fetchSpectyraV1("anonymous/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId: st.installationId,
        appVersion: companionPackageVersion(),
        platform: process.platform,
        source: "openclaw",
      }),
    });
  } catch {
    /* never block optimization */
  }
}

export function sendAnonymousEvent(eventName: string, properties?: Record<string, unknown>): void {
  void sendAnonymousEventAsync(eventName, properties);
}

async function sendAnonymousEventAsync(eventName: string, properties?: Record<string, unknown>): Promise<void> {
  try {
    const st = readCompanionInstallState();
    if (!st) return;
    await fetchSpectyraV1("anonymous/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId: st.installationId,
        eventName,
        appVersion: companionPackageVersion(),
        properties: properties ?? undefined,
      }),
    });
  } catch {
    /* never block optimization */
  }
}

export function maybeSendOptimizationPerformedEvent(): void {
  const now = Date.now();
  if (now - lastOptimizationPerfAt < OPT_EVENT_DEBOUNCE_MS) return;
  lastOptimizationPerfAt = now;
  sendAnonymousEvent("optimization_performed");
}

export function sendFirstOptimizationOnce(): void {
  if (existsSync(FIRST_OPT_FLAG)) return;
  try {
    mkdirSync(join(homedir(), ".spectyra", "companion"), { recursive: true });
    writeFileSync(FIRST_OPT_FLAG, `${new Date().toISOString()}\n`);
    sendAnonymousEvent("first_optimization");
  } catch {
    /* */
  }
}
