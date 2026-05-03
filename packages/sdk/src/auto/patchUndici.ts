import { createRequire } from "node:module";

/**
 * When `node:undici` exposes a `fetch` distinct from `globalThis.fetch`, delegate to `globalThis.fetch`
 * so the global {@link installFetchPatch} instrumentation applies to undici callers too.
 */
export function installUndiciFetchAlias(): () => void {
  try {
    const require = createRequire(import.meta.url);
    const undici = require("node:undici") as { fetch?: typeof fetch };
    if (typeof undici.fetch !== "function") return () => {};
    const orig = undici.fetch;
    if (orig === globalThis.fetch) return () => {};
    undici.fetch = ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)) as typeof fetch;
    return () => {
      undici.fetch = orig;
    };
  } catch {
    return () => {};
  }
}
