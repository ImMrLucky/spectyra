import type {
  CompanionConnectionState,
  CompanionHealth,
  OpenClawLatestOk,
  OpenClawLatestResponse,
  SpectyraFlowSummary,
  SpectyraTraceSavingsView,
} from "./companion-types.js";
import { SafeLogger } from "../utils/safe-logger.js";

/** Fixed localhost companion URL (no env reads in runtime code). */
export const SPECTYRA_COMPANION_BASE = "http://127.0.0.1:4111";

const log = new SafeLogger();

async function safeJson(res: Response): Promise<unknown | null> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) {
    return null;
  }
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export class CompanionClient {
  constructor(private readonly baseUrl: string = SPECTYRA_COMPANION_BASE) {}

  async pingHealth(): Promise<CompanionHealth | null> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: "GET" });
      if (!res.ok) {
        log.warn("Companion health non-OK", { status: res.status });
        return null;
      }
      const body = await safeJson(res);
      return isRecord(body) ? (body as CompanionHealth) : null;
    } catch (e) {
      log.warn("Companion health fetch failed", { errorClass: e instanceof Error ? e.name : "unknown" });
      return null;
    }
  }

  async getOpenClawStatus(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${this.baseUrl}/openclaw/v1/status`, { method: "GET" });
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        return null;
      }
      const body = await safeJson(res);
      return isRecord(body) ? body : null;
    } catch {
      return null;
    }
  }

  async getTrace(traceId: string): Promise<Record<string, unknown> | null> {
    const id = encodeURIComponent(traceId);
    try {
      const res = await fetch(`${this.baseUrl}/openclaw/v1/traces/${id}`, { method: "GET" });
      if (res.status === 404) {
        log.info("Spectyra trace lookup failed", { traceId, status: 404 });
        return null;
      }
      if (!res.ok) {
        log.info("Spectyra trace lookup failed", { traceId, status: res.status });
        return null;
      }
      const body = await safeJson(res);
      return isRecord(body) ? body : null;
    } catch (e) {
      log.warn("Spectyra trace lookup failed", { traceId, errorClass: e instanceof Error ? e.name : "unknown" });
      return null;
    }
  }

  async getFlow(flowId: string): Promise<Record<string, unknown> | null> {
    const id = encodeURIComponent(flowId);
    try {
      const res = await fetch(`${this.baseUrl}/openclaw/v1/flows/${id}`, { method: "GET" });
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        return null;
      }
      const body = await safeJson(res);
      return isRecord(body) ? body : null;
    } catch {
      return null;
    }
  }

  /**
   * Fire-and-forget correlation event (no prompt text). Companion may 404 until implemented.
   */
  postEvent(payload: Record<string, unknown>): void {
    void fetch(`${this.baseUrl}/openclaw/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }

  async connectionState(): Promise<CompanionConnectionState> {
    try {
      const h = await this.pingHealth();
      return { reachable: h !== null && (h.status === "ok" || h.service !== undefined), health: h };
    } catch (e) {
      return {
        reachable: false,
        health: null,
        lastErrorClass: e instanceof Error ? e.name : "unknown",
      };
    }
  }

  /** Read-only: last persisted optimization run (see local companion `openclawPluginReadApi`). */
  async getOpenClawLatest(): Promise<OpenClawLatestResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/openclaw/v1/latest`, { method: "GET" });
      const body = await safeJson(res);
      if (!isRecord(body)) {
        return null;
      }
      if (body.ok === false) {
        return body as { ok: false; reason: string };
      }
      return body as unknown as OpenClawLatestOk;
    } catch {
      return null;
    }
  }

  async getOpenClawRecent(limit = 10): Promise<{ ok: true; items: OpenClawLatestOk[] } | null> {
    try {
      const lim = Math.min(50, Math.max(1, Math.floor(limit)));
      const res = await fetch(`${this.baseUrl}/openclaw/v1/recent?limit=${lim}`, { method: "GET" });
      const body = await safeJson(res);
      if (!isRecord(body) || body.ok !== true) {
        return null;
      }
      const raw = body.items;
      if (!Array.isArray(raw)) {
        return null;
      }
      const items = raw
        .filter((x) => isRecord(x) && x.ok === true)
        .map((x) => x as unknown as OpenClawLatestOk);
      return { ok: true, items };
    } catch {
      return null;
    }
  }

  /** Aggregate flow row from companion (read-only aggregation of persisted runs). */
  async getOpenClawFlowsLatest(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${this.baseUrl}/openclaw/v1/flows/latest`, { method: "GET" });
      if (!res.ok) {
        return null;
      }
      const body = await safeJson(res);
      return isRecord(body) ? body : null;
    } catch {
      return null;
    }
  }
}

export function openClawLatestOkToView(p: OpenClawLatestOk): SpectyraTraceSavingsView {
  return {
    traceId: p.traceId,
    percentSaved: p.percentSaved,
    estimatedCostSaved: p.estimatedCostSaved,
    inputTokensBefore: p.inputTokensBefore,
    inputTokensAfter: p.inputTokensAfter,
    outputTokensBefore: p.outputTokensBefore,
    outputTokensAfter: p.outputTokensAfter,
    raw: p as unknown as Record<string, unknown>,
  };
}

/** Map companion trace JSON to a view; returns null if no numeric savings fields. */
export function traceJsonToSavingsView(traceId: string, json: Record<string, unknown>): SpectyraTraceSavingsView | null {
  const percentSaved = num(json.percentSaved ?? json.percent_saved ?? json.savingsPercent);
  const estimatedCostSaved = num(json.estimatedCostSaved ?? json.estimated_cost_saved ?? json.savingsAmount);
  const inputTokensBefore = num(json.inputTokensBefore ?? json.input_tokens_before);
  const inputTokensAfter = num(json.inputTokensAfter ?? json.input_tokens_after);
  const outputTokensBefore = num(json.outputTokensBefore ?? json.output_tokens_before);
  const outputTokensAfter = num(json.outputTokensAfter ?? json.output_tokens_after);
  const currency = str(json.currency);

  const hasSignal =
    percentSaved !== undefined ||
    estimatedCostSaved !== undefined ||
    (inputTokensBefore !== undefined && inputTokensAfter !== undefined) ||
    (outputTokensBefore !== undefined && outputTokensAfter !== undefined);

  if (!hasSignal) {
    return null;
  }

  return {
    traceId,
    percentSaved,
    estimatedCostSaved,
    currency,
    inputTokensBefore,
    inputTokensAfter,
    outputTokensBefore,
    outputTokensAfter,
    raw: json,
  };
}

export function flowJsonToSummary(flowId: string, json: Record<string, unknown>): SpectyraFlowSummary | null {
  const summary: SpectyraFlowSummary = {
    flowId,
    totalInputTokensBefore: num(json.totalInputTokensBefore ?? json.total_input_tokens_before),
    totalInputTokensAfter: num(json.totalInputTokensAfter ?? json.total_input_tokens_after),
    totalOutputTokensBefore: num(json.totalOutputTokensBefore ?? json.total_output_tokens_before),
    totalOutputTokensAfter: num(json.totalOutputTokensAfter ?? json.total_output_tokens_after),
    estimatedCostBefore: num(json.estimatedCostBefore ?? json.estimated_cost_before),
    estimatedCostAfter: num(json.estimatedCostAfter ?? json.estimated_cost_after),
    estimatedCostSaved: num(json.estimatedCostSaved ?? json.estimated_cost_saved),
    percentSaved: num(json.percentSaved ?? json.percent_saved),
    stepsOptimized: num(json.stepsOptimized ?? json.steps_optimized),
    totalSteps: num(json.totalSteps ?? json.total_steps),
  };

  const hs = json.highestSavingStep ?? json.highest_saving_step;
  if (isRecord(hs)) {
    const name = str(hs.name);
    const ps = num(hs.percentSaved ?? hs.percent_saved);
    if (name && ps !== undefined) {
      summary.highestSavingStep = { name, percentSaved: ps };
    }
  }

  const hasAny =
    summary.percentSaved !== undefined ||
    summary.estimatedCostSaved !== undefined ||
    summary.totalInputTokensBefore !== undefined ||
    summary.estimatedCostBefore !== undefined ||
    summary.stepsOptimized !== undefined;

  return hasAny ? summary : null;
}
