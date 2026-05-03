import type { MonitorEngine } from "../monitor/monitorEngine.js";
import { recordMonitorFromJsonBody } from "./recordFromJson.js";

const t0ForConfig = new WeakMap<object, number>();

export function installAxiosInterceptor(
  getEngine: () => MonitorEngine | null,
  defaults: { project?: string; environment?: string; service?: string },
): () => void {
  let cleanup: (() => void) | undefined;

  void import("axios")
    .then(({ default: axios }) => {
      const reqId = axios.interceptors.request.use((cfg) => {
        t0ForConfig.set(cfg as object, typeof performance !== "undefined" ? performance.now() : Date.now());
        return cfg;
      });

      const resId = axios.interceptors.response.use(
        (res) => {
          try {
            const t0 = t0ForConfig.get(res.config as object) ?? (typeof performance !== "undefined" ? performance.now() : Date.now());
            const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
            const latencyMs = Math.max(0, t1 - t0);
            const urlStr = String(res.config?.url ?? "");
            const base = String(res.config?.baseURL ?? "");
            const full = urlStr.startsWith("http") ? urlStr : base ? new URL(urlStr, base).href : urlStr;
            const u = new URL(full, "http://localhost");
            const raw = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
            recordMonitorFromJsonBody({
              engine: getEngine(),
              host: u.hostname,
              pathname: u.pathname,
              method: String(res.config.method ?? "get").toUpperCase(),
              statusCode: res.status,
              latencyMs,
              bodyText: raw,
              integrationMode: "auto_provider_sdk",
              ...defaults,
            });
          } catch {
            /* */
          }
          return res;
        },
        (err) => Promise.reject(err),
      );

      cleanup = () => {
        axios.interceptors.request.eject(reqId);
        axios.interceptors.response.eject(resId);
      };
    })
    .catch(() => {
      cleanup = () => {};
    });

  return () => {
    cleanup?.();
  };
}
