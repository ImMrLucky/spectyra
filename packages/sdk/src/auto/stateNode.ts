import type { MonitorEngine } from "../monitor/monitorEngine.js";
import { installHttpPatch } from "./patchHttp.js";
import { installUndiciFetchAlias } from "./patchUndici.js";

export function installNodeHttpAndUndici(
  getEngine: () => MonitorEngine | null,
  defaults: { project?: string; environment?: string; service?: string },
): () => void {
  const uHttp = installHttpPatch(getEngine, defaults);
  const uUndici = installUndiciFetchAlias();
  return () => {
    uHttp();
    uUndici();
  };
}
