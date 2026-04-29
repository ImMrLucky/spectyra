import { startSpectyraAuto } from "./state.js";

export { startSpectyraAuto, stopSpectyraAuto, getAutoMonitorEngine } from "./state.js";
export { installUndiciFetchAlias } from "./patchUndici.js";
export type { SpectyraAutoStartOptions } from "./config.js";

if (typeof process !== "undefined" && process.env?.SPECTYRA_AUTO !== "false") {
  try {
    startSpectyraAuto({});
  } catch {
    /* fail open — never break app bootstrap */
  }
}
