/**
 * Local dev HTTP bridge: `GET /__spectyra/monitor/*` serves JSON from a {@link MonitorEngine}.
 * Disabled in production unless `SPECTYRA_DEV_BRIDGE=true`.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { MonitorEngine } from "./monitorEngine.js";
import type { SpectyraMonitorEvent, SpectyraMonitorSummary } from "./monitorTypes.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export type SpectyraDevBridgeMonitorEngine = Pick<MonitorEngine, "getMonitorSummary" | "getRecentMonitorEvents">;

/**
 * When `false`, the bridge never handles requests (default in `NODE_ENV=production` unless overridden).
 */
export function isSpectyraDevBridgeEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.SPECTYRA_DEV_BRIDGE === "true") return true;
  if (process.env.SPECTYRA_DEV_BRIDGE === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function pathOnly(url: string): string {
  const q = url.indexOf("?");
  return (q >= 0 ? url.slice(0, q) : url) || "/";
}

function parseLimit(url: string): number {
  try {
    const u = new URL(url, "http://127.0.0.1");
    const n = parseInt(u.searchParams.get("limit") || "50", 10);
    if (!Number.isFinite(n) || n < 1) return 50;
    return Math.min(n, 500);
  } catch {
    return 50;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS,
    "Content-Length": Buffer.byteLength(payload, "utf8"),
  });
  res.end(payload);
}

/**
 * If the request targets `/__spectyra/monitor/*`, write the response and return `true`.
 * Otherwise return `false` (caller should continue the pipeline).
 */
export function handleSpectyraDevBridgeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  engine: SpectyraDevBridgeMonitorEngine,
): boolean {
  if (!isSpectyraDevBridgeEnabled()) return false;

  const method = (req.method || "GET").toUpperCase();
  const p = pathOnly(req.url || "");

  if (!p.startsWith("/__spectyra/")) return false;

  if (method === "OPTIONS") {
    res.writeHead(204, { ...CORS });
    res.end();
    return true;
  }

  if (method !== "GET") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }

  if (p === "/__spectyra/monitor/summary") {
    sendJson(res, 200, engine.getMonitorSummary() as SpectyraMonitorSummary);
    return true;
  }

  if (p === "/__spectyra/monitor/events") {
    const lim = parseLimit(req.url || "");
    sendJson(res, 200, engine.getRecentMonitorEvents(lim) as SpectyraMonitorEvent[]);
    return true;
  }

  sendJson(res, 404, { error: "not_found", path: p });
  return true;
}

/**
 * Connect/Express-style middleware: handles `/__spectyra/*` then calls `next()`.
 */
export function createSpectyraDevBridgeConnectMiddleware(
  getEngine: () => SpectyraDevBridgeMonitorEngine | null,
): (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void {
  return (req, res, next) => {
    try {
      const p = pathOnly(req.url || "");
      if (!p.startsWith("/__spectyra/")) {
        next();
        return;
      }
      const engine = getEngine();
      if (!engine) {
        sendJson(res, 503, { error: "monitor_engine_unavailable" });
        return;
      }
      if (handleSpectyraDevBridgeRequest(req, res, engine)) return;
    } catch {
      /* fail open */
    }
    next();
  };
}

/**
 * @deprecated No-op. Use {@link createSpectyraDevBridgeConnectMiddleware} and {@link handleSpectyraDevBridgeRequest}.
 */
export function createSpectyraDevBridgePlaceholder(): void {}
