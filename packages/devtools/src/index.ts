/**
 * @packageDocumentation
 * Lit devtools + SDK re-exports for Spectyra monitoring overlay.
 */

export { mountSpectyraDevtools, shouldMountDevtoolsByDefault } from "@spectyra/sdk";
export type { SpectyraDevtoolsMountHandle } from "@spectyra/sdk";

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
