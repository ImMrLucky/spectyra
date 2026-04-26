import type { CompanionClient } from "./companion-client.js";
import type { OpenClawLatestOk } from "./companion-types.js";
import { isFreshOpenClawTimestamp } from "./seamless-helpers.js";

/**
 * Polls companion `GET /openclaw/v1/latest` on an interval (non-blocking).
 * Keeps a fresh snapshot for seamless inline savings without manual trace wiring.
 */
export class LatestSavingsCoordinator {
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshot: OpenClawLatestOk | null = null;
  private readonly inlineTraceIds = new Set<string>();
  private readonly maxInlineIds = 200;

  constructor(
    private readonly client: CompanionClient,
    private readonly intervalMs = 2500,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Latest row if companion returned data and timestamp is within the freshness window. */
  getFreshLatest(): OpenClawLatestOk | null {
    if (!this.snapshot?.timestamp) {
      return null;
    }
    return isFreshOpenClawTimestamp(this.snapshot.timestamp) ? this.snapshot : null;
  }

  alreadyShownInline(traceId: string): boolean {
    return this.inlineTraceIds.has(traceId);
  }

  rememberInline(traceId: string): void {
    this.inlineTraceIds.add(traceId);
    while (this.inlineTraceIds.size > this.maxInlineIds) {
      const first = this.inlineTraceIds.values().next().value;
      if (first === undefined) {
        break;
      }
      this.inlineTraceIds.delete(first);
    }
  }

  private async tick(): Promise<void> {
    try {
      const j = await this.client.getOpenClawLatest();
      if (!j) {
        return;
      }
      if (j.ok === false) {
        if (j.reason === "no_recent_result") {
          this.snapshot = null;
        }
        return;
      }
      if (!isFreshOpenClawTimestamp(j.timestamp)) {
        if (this.snapshot && !isFreshOpenClawTimestamp(this.snapshot.timestamp)) {
          this.snapshot = null;
        }
        return;
      }
      this.snapshot = j;
    } catch {
      /* ignore */
    }
  }
}
