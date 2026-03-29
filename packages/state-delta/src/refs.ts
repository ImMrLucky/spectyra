import { createHash } from "node:crypto";
import { stableStringify } from "./json-stable.js";
import type { RefHandle } from "./types.js";

function parseHandle(h: string): string | null {
  const m = /^ref:sha256:([a-f0-9]{16})$/.exec(h);
  return m ? m[1]! : null;
}

/**
 * Local reversible ref table — same process lifetime as the companion buffer.
 * Full hex digest kept internally; handles expose a short prefix for summaries.
 */
export class RefStore {
  private readonly byPrefix = new Map<string, string>();
  private readonly byFull = new Map<string, unknown>();

  put(value: unknown): RefHandle {
    const json = stableStringify(value);
    const full = createHash("sha256").update(json, "utf8").digest("hex");
    const prefix = full.slice(0, 16);
    this.byPrefix.set(prefix, full);
    if (!this.byFull.has(full)) this.byFull.set(full, JSON.parse(json) as unknown);
    return `ref:sha256:${prefix}` as RefHandle;
  }

  get(handle: RefHandle | string): unknown | undefined {
    const prefix = parseHandle(typeof handle === "string" ? handle : handle);
    if (!prefix) return undefined;
    const full = this.byPrefix.get(prefix);
    return full ? this.byFull.get(full) : undefined;
  }

  /** Bytes if every stored value were inlined as JSON (approx duplication savings). */
  storedCount(): number {
    return this.byFull.size;
  }
}
