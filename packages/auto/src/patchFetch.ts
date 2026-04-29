import type { MonitorEngine } from "@spectyra/sdk";
import { recordMonitorFromJsonBody } from "./recordFromJson.js";

type FetchFn = typeof fetch;

export function installFetchPatch(
  getEngine: () => MonitorEngine | null,
  defaults: { project?: string; environment?: string; service?: string },
): () => void {
  if (typeof globalThis.fetch !== "function") return () => {};

  const original = globalThis.fetch.bind(globalThis) as FetchFn;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let urlStr = "";
    try {
      urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    } catch {
      return original(input, init);
    }

    let u: URL;
    try {
      u = new URL(urlStr);
    } catch {
      return original(input, init);
    }

    let method = "GET";
    if (typeof input !== "string" && !(input instanceof URL)) {
      method = (input as Request).method?.toUpperCase() ?? "GET";
    } else {
      method = (init?.method ?? "GET").toUpperCase();
    }

    const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const res = await original(input, init);
    const t1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const latencyMs = Math.max(0, t1 - t0);

    void (async () => {
      try {
        const clone = res.clone();
        const text = await clone.text();
        recordMonitorFromJsonBody({
          engine: getEngine(),
          host: u.hostname,
          pathname: u.pathname,
          method,
          statusCode: res.status,
          latencyMs,
          bodyText: text,
          integrationMode: "auto_fetch",
          ...defaults,
        });
      } catch {
        /* ignore */
      }
    })();

    return res;
  };

  return () => {
    globalThis.fetch = original;
  };
}
