import { stableStringify } from "./json-stable.js";
import { createHash } from "node:crypto";
import type { CanonicalState } from "./types.js";

export type SharedBlobOrigin = {
  sessionId: string;
  stepId?: string;
  key: string;
};

/**
 * Content-addressed index for cross-step / cross-session reuse (local-first).
 */
export class SharedContextIndex {
  private readonly hashToOrigin = new Map<string, SharedBlobOrigin>();
  private reuseCount = 0;

  contentHash(value: unknown): string {
    return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
  }

  /**
   * Register a value; returns whether this hash was seen before (reuse).
   */
  note(sessionId: string, stepId: string | undefined, key: string, value: unknown): { reused: boolean; hash: string } {
    const hash = this.contentHash(value);
    if (this.hashToOrigin.has(hash)) {
      this.reuseCount += 1;
      return { reused: true, hash };
    }
    this.hashToOrigin.set(hash, { sessionId, stepId, key });
    return { reused: false, hash };
  }

  noteStateSlice(sessionId: string, stepId: string | undefined, state: CanonicalState): void {
    for (const [key, value] of Object.entries(state)) {
      this.note(sessionId, stepId, key, value);
    }
  }

  uniqueBlobCount(): number {
    return this.hashToOrigin.size;
  }

  reuseHitCount(): number {
    return this.reuseCount;
  }
}
