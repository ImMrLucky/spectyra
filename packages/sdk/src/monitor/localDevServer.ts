/**
 * Local dev HTTP bridge: `GET {routePrefix}/summary|events|waste|stream` (+ legacy `/monitor/*`).
 * Disabled in production unless `SPECTYRA_DEV_BRIDGE=true` or `localDevServer.enabled === true`.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { SpectyraLocalDevServerConfig } from "../types.js";
import type { MonitorEngine } from "./monitorEngine.js";
import type { SpectyraMonitorEvent, SpectyraMonitorSummary } from "./monitorTypes.js";
import {
  aggregateAllMonitorViews,
} from "./monitorAggregates.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const DEFAULT_ROUTE_PREFIX = "/__spectyra";

/** Default interval between dev-bridge SSE payloads (ms). */
const DEFAULT_STREAM_TICK_MS = 8000;
const MIN_STREAM_TICK_MS = 3000;
const MAX_STREAM_TICK_MS = 120_000;

function resolveStreamTickMs(cfg?: SpectyraLocalDevServerConfig): number {
  let n = cfg?.streamTickMs;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    if (typeof process !== "undefined") {
      const raw = process.env.SPECTYRA_DEV_BRIDGE_STREAM_MS?.trim();
      if (raw) {
        const p = parseInt(raw, 10);
        if (Number.isFinite(p) && p > 0) n = p;
      }
    }
  }
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    n = DEFAULT_STREAM_TICK_MS;
  }
  return Math.min(MAX_STREAM_TICK_MS, Math.max(MIN_STREAM_TICK_MS, Math.round(n)));
}

const DEFAULT_LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

export type SpectyraDevBridgeMonitorEngine = Pick<
  MonitorEngine,
  "getMonitorSummary" | "getRecentMonitorEvents" | "getEventsSnapshot"
>;

export function normalizeDevBridgeRoutePrefix(routePrefix?: string): string {
  const raw = (routePrefix ?? DEFAULT_ROUTE_PREFIX).trim().replace(/\/$/, "") || DEFAULT_ROUTE_PREFIX;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/**
 * When `false`, the bridge never handles requests (default in `NODE_ENV=production` unless overridden).
 * Pass `localDevServer` from {@link SpectyraConfig} for stricter defaults (localhost + optional token).
 */
export function isSpectyraDevBridgeEnabled(cfg?: SpectyraLocalDevServerConfig): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.SPECTYRA_DEV_BRIDGE === "false") return false;
  if (cfg?.enabled === false) return false;
  if (process.env.SPECTYRA_DEV_BRIDGE === "true") return true;
  if (cfg?.enabled === true) return true;
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

function sendJavaScript(res: ServerResponse, body: string, cacheControl: string): void {
  res.writeHead(200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "Cache-Control": cacheControl,
    ...CORS,
    "Content-Length": Buffer.byteLength(body, "utf8"),
  });
  res.end(body);
}

/** Resolve `https://host` for overlay bootstrap when UI is on a different origin than this API. */
export function resolveSpectyraDevBridgePublicOrigin(
  req: IncomingMessage,
  cfg?: SpectyraLocalDevServerConfig,
): string {
  const trimmed = cfg?.publicOrigin?.trim();
  if (trimmed) return trimmed.replace(/\/$/, "");
  const xfProto = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  const xfHost = String(req.headers["x-forwarded-host"] ?? "")
    .split(",")[0]
    ?.trim();
  const rawHost = xfHost || (req.headers.host ?? "").trim();
  if (!rawHost) return "http://localhost";

  let proto: string;
  if (xfProto === "http" || xfProto === "https") {
    proto = xfProto;
  } else {
    const lower = rawHost.split(":")[0]?.toLowerCase() ?? "";
    proto =
      lower === "localhost" || lower === "127.0.0.1" || lower === "[::1]" || lower.endsWith(".local")
        ? "http"
        : "https";
  }
  return `${proto}://${rawHost}`.replace(/\/$/, "");
}

function sendOverlayBootstrapJs(res: ServerResponse, req: IncomingMessage, cfg?: SpectyraLocalDevServerConfig): void {
  const origin = resolveSpectyraDevBridgePublicOrigin(req, cfg);
  const literal = JSON.stringify(origin);
  const body = `/* Spectyra — sets window.__SPECTYRA_OVERLAY_BASE_URL__ for split UI/API hosts */
(function(){try{if(typeof window!=="undefined"){window.__SPECTYRA_OVERLAY_BASE_URL__=${literal};}}catch(e){}})();
`;
  sendJavaScript(res, body, "public, max-age=120");
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

function requestHostHeader(req: IncomingMessage): string {
  const h = (req.headers.host || "").split(":")[0]?.trim().toLowerCase() ?? "";
  return h;
}

function resolveAllowedHosts(cfg?: SpectyraLocalDevServerConfig): string[] | null {
  if (!cfg) return null;
  if (cfg.allowedHosts && cfg.allowedHosts.length > 0) {
    return cfg.allowedHosts.map((h) => h.split(":")[0]!.trim().toLowerCase());
  }
  return DEFAULT_LOCAL_HOSTS.map((h) => h.toLowerCase());
}

function isHostAllowed(req: IncomingMessage, cfg?: SpectyraLocalDevServerConfig): boolean {
  const allowed = resolveAllowedHosts(cfg);
  if (!allowed) return true;
  const h = requestHostHeader(req);
  return allowed.includes(h);
}

function verifyDevToken(req: IncomingMessage, token?: string): boolean {
  if (!token) return true;
  const auth = req.headers.authorization;
  if (auth === `Bearer ${token}`) return true;
  try {
    const u = new URL(req.url || "", "http://127.0.0.1");
    if (u.searchParams.get("token") === token) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function eventsSnapshot(engine: SpectyraDevBridgeMonitorEngine): SpectyraMonitorEvent[] {
  return engine.getEventsSnapshot?.() ?? engine.getRecentMonitorEvents(10_000);
}

/**
 * If the request targets the dev bridge paths under `routePrefix`, write the response and return `true`.
 * Otherwise return `false` (caller should continue the pipeline).
 */
export function handleSpectyraDevBridgeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  engine: SpectyraDevBridgeMonitorEngine,
  cfg?: SpectyraLocalDevServerConfig,
): boolean {
  const routePrefix = normalizeDevBridgeRoutePrefix(cfg?.routePrefix);
  const method = (req.method || "GET").toUpperCase();
  const p = pathOnly(req.url || "");

  if (!p.startsWith(`${routePrefix}/`) && p !== routePrefix) return false;

  if (!isSpectyraDevBridgeEnabled(cfg)) {
    sendJson(res, 404, { error: "dev_bridge_disabled" });
    return true;
  }

  if (!isHostAllowed(req, cfg)) {
    sendJson(res, 403, { error: "host_not_allowed" });
    return true;
  }

  if (!verifyDevToken(req, cfg?.token)) {
    sendJson(res, 401, { error: "unauthorized" });
    return true;
  }

  if (method === "OPTIONS") {
    res.writeHead(204, { ...CORS });
    res.end();
    return true;
  }

  if (method !== "GET") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }

  const sseEnabled = cfg?.sse !== false;

  const isSummary = p === `${routePrefix}/summary` || p === `${routePrefix}/monitor/summary`;
  const isEvents = p === `${routePrefix}/events` || p === `${routePrefix}/monitor/events`;
  const isWaste = p === `${routePrefix}/waste`;
  const isStream = p === `${routePrefix}/stream`;
  const isOverlayBootstrap = p === `${routePrefix}/overlay-bootstrap.js`;

  if (isOverlayBootstrap) {
    sendOverlayBootstrapJs(res, req, cfg);
    return true;
  }

  if (isSummary) {
    sendJson(res, 200, engine.getMonitorSummary() as SpectyraMonitorSummary);
    return true;
  }

  if (isEvents) {
    const lim = parseLimit(req.url || "");
    sendJson(res, 200, engine.getRecentMonitorEvents(lim) as SpectyraMonitorEvent[]);
    return true;
  }

  if (isWaste) {
    const evs = eventsSnapshot(engine);
    const agg = aggregateAllMonitorViews(evs);
    sendJson(res, 200, {
      waste: agg.waste,
      views: {
        repeated: agg.repeated.slice(0, 50),
        cache: agg.cache.slice(0, 50),
      },
    });
    return true;
  }

  if (isStream) {
    if (!sseEnabled) {
      sendJson(res, 404, { error: "sse_disabled" });
      return true;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...CORS,
    });
    res.flushHeaders?.();

    const tickMs = resolveStreamTickMs(cfg);
    let lastPayload = "";

    const tick = () => {
      try {
        const evs = eventsSnapshot(engine);
        const agg = aggregateAllMonitorViews(evs);
        const payload = JSON.stringify({
          summary: engine.getMonitorSummary(),
          waste: agg.waste,
          eventTail: engine.getRecentMonitorEvents(200),
        });
        if (payload === lastPayload) return;
        lastPayload = payload;
        res.write(`data: ${payload}\n\n`);
      } catch {
        /* ignore */
      }
    };

    tick();
    const iv = setInterval(tick, tickMs);
    const keepalive = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch {
        /* ignore */
      }
    }, 25_000);
    req.on("close", () => {
      clearInterval(iv);
      clearInterval(keepalive);
      try {
        res.end();
      } catch {
        /* ignore */
      }
    });
    return true;
  }

  sendJson(res, 404, { error: "not_found", path: p });
  return true;
}

/**
 * Connect/Express-style middleware: handles `{routePrefix}/*` then calls `next()`.
 */
export function createSpectyraDevBridgeConnectMiddleware(
  getEngine: () => SpectyraDevBridgeMonitorEngine | null,
  localDevServer?: SpectyraLocalDevServerConfig,
): (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void {
  return (req, res, next) => {
    try {
      const routePrefix = normalizeDevBridgeRoutePrefix(localDevServer?.routePrefix);
      const p = pathOnly(req.url || "");
      if (!p.startsWith(`${routePrefix}/`) && p !== routePrefix) {
        next();
        return;
      }
      const engine = getEngine();
      if (!engine) {
        sendJson(res, 503, { error: "monitor_engine_unavailable" });
        return;
      }
      if (handleSpectyraDevBridgeRequest(req, res, engine, localDevServer)) return;
    } catch {
      /* fail open */
    }
    next();
  };
}

/**
 * Fastify registration helper (no `fastify` dependency — pass your Fastify instance).
 * Uses `reply.raw` / `request.raw` so streaming and headers match the generic Node handler.
 */
export function registerSpectyraDevBridgeFastify(
  fastify: {
    get: (
      path: string,
      handler: (req: { raw: IncomingMessage }, reply: { raw: ServerResponse }) => void | Promise<void>,
    ) => unknown;
  },
  options: {
    getEngine: () => SpectyraDevBridgeMonitorEngine | null;
    localDevServer?: SpectyraLocalDevServerConfig;
  },
): void {
  const prefix = normalizeDevBridgeRoutePrefix(options.localDevServer?.routePrefix);
  const paths = [
    `${prefix}/summary`,
    `${prefix}/events`,
    `${prefix}/waste`,
    `${prefix}/stream`,
    `${prefix}/overlay-bootstrap.js`,
    `${prefix}/monitor/summary`,
    `${prefix}/monitor/events`,
  ];
  for (const path of paths) {
    fastify.get(path, (req, reply) => {
      const engine = options.getEngine();
      if (!engine) {
        sendJson(reply.raw, 503, { error: "monitor_engine_unavailable" });
        return;
      }
      handleSpectyraDevBridgeRequest(req.raw, reply.raw, engine, options.localDevServer);
    });
  }
}

/**
 * @deprecated No-op. Use {@link createSpectyraDevBridgeConnectMiddleware} and {@link handleSpectyraDevBridgeRequest}.
 */
export function createSpectyraDevBridgePlaceholder(): void {}
