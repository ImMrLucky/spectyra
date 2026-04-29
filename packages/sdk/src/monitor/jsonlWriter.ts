import type { SpectyraMonitorEvent } from "./monitorTypes.js";
import { scrubMonitorEventForPersistence } from "./redaction.js";

function ymdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Append one JSON line; never throws; no-ops when fs is unavailable (e.g. browser bundle).
 */
export class MonitorJsonlWriter {
  private readonly userPath?: string;
  private readonly rotateDaily: boolean;
  private readonly maxFileSizeMb?: number;
  private queue: Promise<void> = Promise.resolve();

  constructor(opts: { path?: string; rotateDaily?: boolean; maxFileSizeMb?: number }) {
    this.userPath = opts.path?.trim() || undefined;
    this.rotateDaily = opts.rotateDaily !== false;
    this.maxFileSizeMb = opts.maxFileSizeMb;
  }

  private pathFor(date: Date): string {
    if (!this.userPath) {
      return `./spectyra-usage-${ymdUtc(date)}.jsonl`;
    }
    if (!this.rotateDaily) return this.userPath;
    if (this.userPath.endsWith(".jsonl")) {
      return this.userPath.replace(/\.jsonl$/i, `-${ymdUtc(date)}.jsonl`);
    }
    return `${this.userPath}-${ymdUtc(date)}.jsonl`;
  }

  append(ev: SpectyraMonitorEvent): void {
    const line = JSON.stringify(scrubMonitorEventForPersistence(ev));
    const filePath = this.pathFor(new Date());
    this.queue = this.queue
      .then(() => appendLineSafe(filePath, line, this.maxFileSizeMb))
      .catch(() => {});
  }
}

async function appendLineSafe(filePath: string, line: string, maxFileSizeMb?: number): Promise<void> {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    if (maxFileSizeMb != null && maxFileSizeMb > 0) {
      try {
        const st = await fs.stat(filePath);
        if (st.size >= maxFileSizeMb * 1024 * 1024) {
          return;
        }
      } catch {
        /* file may not exist yet */
      }
    }
    await fs.appendFile(filePath, `${line}\n`, "utf8");
  } catch {
    /* fail open */
  }
}
