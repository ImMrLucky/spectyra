import { createRequire } from "node:module";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { MonitorEngine } from "@spectyra/sdk";
import { detectProviderFromHost } from "@spectyra/sdk";
import { recordMonitorFromHttpResponseOnly } from "./recordFromJson.js";

/** Mutable `node:http` / `node:https` export objects (not ESM namespace imports). */
const require = createRequire(import.meta.url);
const nodeHttp = require("node:http") as typeof import("node:http");
const nodeHttps = require("node:https") as typeof import("node:https");

function wrapRequest(
  orig: typeof nodeHttp.request,
  getEngine: () => MonitorEngine | null,
  defaults: { project?: string; environment?: string; service?: string },
): typeof nodeHttp.request {
  return function request(this: unknown, ...args: unknown[]) {
    const t0 = Date.now();
    const first = args[0];
    let hostname = "";
    let path = "/";
    let method = "GET";

    if (typeof first === "string") {
      try {
        const u = new URL(first);
        hostname = u.hostname;
        path = u.pathname + u.search;
      } catch {
        /* relative */
      }
    } else if (first && typeof first === "object") {
      const o = first as { hostname?: string; host?: string; path?: string; method?: string };
      if (o.hostname) hostname = String(o.hostname).split(":")[0] ?? "";
      else if (o.host) hostname = String(o.host).split(":")[0] ?? "";
      path = String(o.path ?? "/");
      method = String(o.method ?? "GET").toUpperCase();
    }

    const req = (orig as (...a: unknown[]) => ClientRequest).apply(this, args);
    const provider = hostname ? detectProviderFromHost(hostname) : "unknown";
    if (provider === "unknown") return req;

    req.on("response", (res: IncomingMessage) => {
      const st = res.statusCode ?? 0;
      const latencyMs = Math.max(0, Date.now() - t0);
      const pathname = path.split("?")[0] ?? path;
      recordMonitorFromHttpResponseOnly({
        engine: getEngine(),
        host: hostname,
        pathname,
        method,
        statusCode: st,
        latencyMs,
        integrationMode: "auto_http",
        ...defaults,
      });
    });

    return req;
  } as typeof nodeHttp.request;
}

export function installHttpPatch(
  getEngine: () => MonitorEngine | null,
  defaults: { project?: string; environment?: string; service?: string },
): () => void {
  const oH = nodeHttp.request;
  const oS = nodeHttps.request;
  nodeHttp.request = wrapRequest(oH, getEngine, defaults);
  nodeHttps.request = wrapRequest(oS, getEngine, defaults);
  return () => {
    nodeHttp.request = oH;
    nodeHttps.request = oS;
  };
}
