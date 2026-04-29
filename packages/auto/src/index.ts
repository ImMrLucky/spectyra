import { startSpectyraAuto } from "./state.js";

export { startSpectyraAuto, stopSpectyraAuto, getAutoMonitorEngine } from "./state.js";
export type { SpectyraAutoStartOptions } from "./config.js";

if (typeof process !== "undefined" && process.env?.SPECTYRA_AUTO === "true") {
  try {
    startSpectyraAuto({});
  } catch {
    /* fail open — never break app bootstrap */
  }
}
