import { createMonitorEngine, startPricingRuntime, type MonitorEngine } from "@spectyra/sdk";
import { resolveAutoConfig, type SpectyraAutoStartOptions } from "./config.js";
import { installFetchPatch } from "./patchFetch.js";
import { installHttpPatch } from "./patchHttp.js";
import { installAxiosInterceptor } from "./patchAxios.js";

let engine: MonitorEngine | null = null;
let uninstallFetch: (() => void) | null = null;
let uninstallHttp: (() => void) | null = null;
let uninstallAxios: (() => void) | null = null;

/**
 * Install global fetch / HTTP instrumentation and a dedicated {@link MonitorEngine}.
 * Idempotent: returns the existing engine if already started.
 */
export function startSpectyraAuto(opts: SpectyraAutoStartOptions = {}): MonitorEngine {
  if (engine) return engine;

  const cfg = resolveAutoConfig(opts);
  void startPricingRuntime({});

  engine = createMonitorEngine({
    enabled: true,
    jsonl: cfg.jsonl.enabled
      ? {
          enabled: true,
          path: cfg.jsonl.path,
          rotateDaily: cfg.jsonl.rotateDaily,
          maxFileSizeMb: cfg.jsonl.maxFileSizeMb,
        }
      : { enabled: false },
    console: cfg.consoleEnabled ? { enabled: true, level: "info" } : { enabled: false },
    defaults: {
      project: cfg.project,
      environment: cfg.environment,
      service: cfg.service,
      integrationMode: "auto_fetch",
    },
  });

  const get = () => engine;
  const defaults = { project: cfg.project, environment: cfg.environment, service: cfg.service };
  uninstallFetch = installFetchPatch(get, defaults);
  uninstallHttp = installHttpPatch(get, defaults);
  uninstallAxios = installAxiosInterceptor(get, defaults);

  return engine;
}

export function stopSpectyraAuto(): void {
  uninstallFetch?.();
  uninstallHttp?.();
  uninstallAxios?.();
  uninstallFetch = uninstallHttp = uninstallAxios = null;
  engine = null;
}

export function getAutoMonitorEngine(): MonitorEngine | null {
  return engine;
}
