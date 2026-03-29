/**
 * Node-only: append / read normalized SpectyraEvent streams as JSONL.
 * Import from `@spectyra/event-core/local-persistence` (not the main barrel) so browser bundles avoid fs.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { SpectyraEvent } from "./types.js";

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

/**
 * Append one normalized event as a single JSON line (local audit / replay).
 */
export async function appendNormalizedEventJsonl(filePath: string, event: SpectyraEvent): Promise<void> {
  await ensureParentDir(filePath);
  await fs.appendFile(filePath, JSON.stringify(event) + "\n", "utf-8");
}

/**
 * Read the last `limit` events from a JSONL file (newest last).
 */
export async function readRecentNormalizedEventsJsonl(filePath: string, limit: number): Promise<SpectyraEvent[]> {
  if (limit <= 0) return [];
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    const slice = lines.slice(-limit);
    const out: SpectyraEvent[] = [];
    for (const line of slice) {
      try {
        out.push(JSON.parse(line) as SpectyraEvent);
      } catch {
        /* skip corrupt line */
      }
    }
    return out;
  } catch {
    return [];
  }
}
