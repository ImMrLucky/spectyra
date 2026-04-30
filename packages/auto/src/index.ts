import { startSpectyraAuto } from "./state.js";

export { startSpectyraAuto, stopSpectyraAuto, getAutoMonitorEngine } from "./state.js";
export { useSpectyraAutoDevBridge } from "./devBridge.js";
export type { SpectyraLocalDevServerConfig } from "./devBridge.js";
export { installUndiciFetchAlias } from "./patchUndici.js";
export type { SpectyraAutoStartOptions } from "./config.js";

if (typeof process !== "undefined" && (process.env?.SPECTYRA_AUTO === "true" || process.env?.SPECTYRA_AUTO === "1")) {
  try {
    startSpectyraAuto({});
  } catch {
    /* fail open — never break app bootstrap */
  }
}
