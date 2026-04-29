/**
 * Side-effect entry: registers `<spectyra-overlay>` and mounts on localhost-like hosts.
 * `import "@spectyra/devtools/auto";`
 */
import { SpectyraOverlay } from "./spectyra-overlay.js";

declare global {
  interface HTMLElementTagNameMap {
    "spectyra-overlay": SpectyraOverlay;
  }
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") {
  if (!customElements.get("spectyra-overlay")) {
    customElements.define("spectyra-overlay", SpectyraOverlay);
  }
  const force = document.documentElement.getAttribute("data-spectyra-overlay") === "force";
  const h = window.location.hostname;
  const devHost = h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local");
  if ((devHost || force) && !document.querySelector("spectyra-overlay")) {
    document.body.appendChild(document.createElement("spectyra-overlay"));
  }
}
