/**
 * Browser Lit components for Spectyra monitoring UI.
 */

export { SpectyraMonitorStrip } from "./spectyra-monitor-strip.js";
export { SpectyraOverlay } from "./spectyra-overlay.js";

import { SpectyraMonitorStrip } from "./spectyra-monitor-strip.js";
import { SpectyraOverlay } from "./spectyra-overlay.js";

declare global {
  interface HTMLElementTagNameMap {
    "spectyra-monitor-strip": SpectyraMonitorStrip;
    "spectyra-overlay": SpectyraOverlay;
  }
}

if (typeof customElements !== "undefined") {
  if (!customElements.get("spectyra-monitor-strip")) {
    customElements.define("spectyra-monitor-strip", SpectyraMonitorStrip);
  }
  if (!customElements.get("spectyra-overlay")) {
    customElements.define("spectyra-overlay", SpectyraOverlay);
  }
}
