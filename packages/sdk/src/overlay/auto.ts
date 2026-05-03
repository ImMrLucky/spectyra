/**
 * Browser entry for `@spectyra/sdk/auto` (via package.json `exports` `browser` condition).
 * Registers `<spectyra-overlay>` and mounts on localhost-like hosts when appropriate.
 */
import { startSpectyraAutoInternal } from "../auto/stateShared.js";
import { SpectyraOverlay } from "./spectyra-overlay.js";

declare global {
  interface HTMLElementTagNameMap {
    "spectyra-overlay": SpectyraOverlay;
  }

  interface Window {
    __SPECTYRA_OVERLAY_BASE_URL__?: string;
    __SPECTYRA_OVERLAY_BRIDGE_TOKEN__?: string;
    __SPECTYRA_OVERLAY_FORCE__?: boolean;
    __SPECTYRA_OVERLAY_POLL_ONLY__?: boolean;
  }
}

export {
  getAutoMonitorEngine,
  getSpectyraAutoState,
  startSpectyraAutoInternal as startSpectyraAuto,
  stopSpectyraAuto,
  type SpectyraAutoHandle,
  type SpectyraAutoState,
} from "../auto/stateShared.js";
export type { SpectyraAutoStartOptions } from "../auto/config.js";
export { recordMonitorFromJsonBody } from "../auto/recordFromJson.js";

/** No-op in browser bundles; use the Node `@spectyra/sdk/auto` entry on your server. */
export function useSpectyraAutoDevBridge(_app: unknown, _options?: unknown): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug("[spectyra] useSpectyraAutoDevBridge is only for Node servers (ignored in browser).");
  }
}

function shouldAutoStartMonitoring(): boolean {
  if (typeof process !== "undefined") {
    const v = process.env?.SPECTYRA_AUTO;
    if (v === "false" || v === "0") return false;
  }
  return true;
}

if (shouldAutoStartMonitoring()) {
  try {
    startSpectyraAutoInternal({});
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") {
  if (!customElements.get("spectyra-overlay")) {
    customElements.define("spectyra-overlay", SpectyraOverlay);
  }
  const forceAttr = document.documentElement.getAttribute("data-spectyra-overlay") === "force";
  const forceWin = Boolean(window.__SPECTYRA_OVERLAY_FORCE__);
  const force = forceAttr || forceWin;
  const h = window.location.hostname;
  const devHost = h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local");
  if ((devHost || force) && !document.querySelector("spectyra-overlay")) {
    const el = document.createElement("spectyra-overlay");
    if (force) {
      el.setAttribute("force-visible", "");
    }
    try {
      const b = window.__SPECTYRA_OVERLAY_BASE_URL__;
      if (b) el.setAttribute("base-url", b.replace(/\/$/, ""));
      const t = window.__SPECTYRA_OVERLAY_BRIDGE_TOKEN__;
      if (t) el.setAttribute("bridge-token", t);
      if (window.__SPECTYRA_OVERLAY_POLL_ONLY__) {
        el.setAttribute("poll-only", "");
      }
    } catch {
      /* ignore */
    }
    document.body.appendChild(el);
  }
}
