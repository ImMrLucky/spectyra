import { createRequire } from "node:module";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { MonitorEngine } from "@spectyra/sdk";
import { detectProviderFromHost } from "@spectyra/sdk";
import { recordMonitorFromJsonBody } from "./recordFromJson.js";

/** Mutable `node:http` / `node:https` export objects (not ESM namespace imports). */
const require = createRequire(import.meta.url);
const nodeHttp = require("node:http") as typeof import("node:http");
const nodeHttps = require("node:https") as typeof import("node:https");

const MAX_BUFFER = 512_000;

function readBody(res: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    res.on("data", (c: Buffer | string) => {
      const buf = typeof c === "string" ? Buffer.from(c) : c;
      size += buf.length;
      if (size <= MAX_BUFFER) chunks.push(buf);
    });
    res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    res.on("error", () => resolve(""));
  });
}

function wrapRequest(
  orig: typeof nodeHttp.request,
  getEngine: () => MonitorEngine | null,
  defaults: { project?: string; environment?: string; service?: string },
): typeof nodeHttp.request {
  return function request(this: unknown, ...args: unknown[]) {
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

    req.on("response", (res) => {
      const st = res.statusCode ?? 0;
      const start = Date.now();
      void (async () => {
        const body = await readBody(res);
        const latencyMs = Math.max(0, Date.now() - start);
        const pathname = path.split("?")[0] ?? path;
        recordMonitorFromJsonBody({
          engine: getEngine(),
          host: hostname,
          pathname,
          method,
          statusCode: st,
          latencyMs,
          bodyText: body,
          integrationMode: "auto_http",
          ...defaults,
        });
      })().catch(() => {});
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
