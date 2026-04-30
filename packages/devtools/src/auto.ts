/**
 * Side-effect entry: registers `<spectyra-overlay>` and mounts on localhost-like hosts,
 * or when forced (see below).
 *
 * `import "@spectyra/devtools/auto";`
 *
 * Optional **before** this import (e.g. inline script or env-injected globals):
 * - `window.__SPECTYRA_OVERLAY_BASE_URL__` — API origin when the UI is not same-origin (no trailing slash).
 * - `window.__SPECTYRA_OVERLAY_BRIDGE_TOKEN__` — Bearer / `?token=` for a protected dev bridge.
 * - `window.__SPECTYRA_OVERLAY_POLL_ONLY__ = true` — force slow HTTP polling (no SSE), e.g. strict proxies.
 *
 * Or set `<html data-spectyra-overlay="force">` instead of `__SPECTYRA_OVERLAY_FORCE__`.
 */
import { SpectyraOverlay } from "./spectyra-overlay.js";

declare global {
  interface HTMLElementTagNameMap {
    "spectyra-overlay": SpectyraOverlay;
  }

  interface Window {
    __SPECTYRA_OVERLAY_BASE_URL__?: string;
    __SPECTYRA_OVERLAY_BRIDGE_TOKEN__?: string;
    __SPECTYRA_OVERLAY_FORCE__?: boolean;
    /** When true, overlay uses slow polling instead of `EventSource` (SSE blocked). */
    __SPECTYRA_OVERLAY_POLL_ONLY__?: boolean;
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
