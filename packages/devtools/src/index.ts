/**
 * @packageDocumentation
 * Lit devtools + SDK re-exports for Spectyra monitoring overlay.
 */

export { mountSpectyraDevtools, shouldMountDevtoolsByDefault } from "@spectyra/sdk";
export type { SpectyraDevtoolsMountHandle } from "@spectyra/sdk";

export { SpectyraMonitorStrip } from "./spectyra-monitor-strip.js";

import { SpectyraMonitorStrip } from "./spectyra-monitor-strip.js";

declare global {
  interface HTMLElementTagNameMap {
    "spectyra-monitor-strip": SpectyraMonitorStrip;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("spectyra-monitor-strip")) {
  customElements.define("spectyra-monitor-strip", SpectyraMonitorStrip);
}
