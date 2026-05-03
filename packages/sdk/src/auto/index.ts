import { installNodeHttpAndUndici } from "./stateNode.js";
import {
  getAutoMonitorEngine,
  getSpectyraAutoState,
  startSpectyraAutoInternal,
  stopSpectyraAuto,
  type SpectyraAutoHandle,
  type SpectyraAutoState,
} from "./stateShared.js";

export type { SpectyraAutoHandle, SpectyraAutoState };

export function startSpectyraAuto(opts: import("./config.js").SpectyraAutoStartOptions = {}): SpectyraAutoHandle {
  return startSpectyraAutoInternal(opts, installNodeHttpAndUndici);
}

export { getAutoMonitorEngine, getSpectyraAutoState, stopSpectyraAuto };
export { useSpectyraAutoDevBridge } from "./devBridge.js";
export type { SpectyraLocalDevServerConfig } from "./devBridge.js";
export { installUndiciFetchAlias } from "./patchUndici.js";
export type { SpectyraAutoStartOptions } from "./config.js";
/** For apps that centralize LLM `fetch` (streaming-safe metadata): same logic as the global fetch patch. */
export { recordMonitorFromJsonBody } from "./recordFromJson.js";

function shouldAutoStartSideEffect(): boolean {
  if (typeof process === "undefined") return false;
  const v = process.env?.SPECTYRA_AUTO;
  if (v === "false" || v === "0") return false;
  return true;
}

if (shouldAutoStartSideEffect()) {
  try {
    startSpectyraAuto({});
  } catch {
    /* fail open — never break app bootstrap */
  }
}
