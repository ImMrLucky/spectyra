import {
  createMonitorCloudSyncDebouncer,
  createMonitorEngine,
  shouldSyncMonitorToCloud,
  startPricingRuntime,
  type MonitorEngine,
} from "@spectyra/sdk";
import type { SpectyraConfig } from "@spectyra/sdk";
import { resolveAutoConfig, type SpectyraAutoStartOptions } from "./config.js";
import { installAxiosInterceptor } from "./patchAxios.js";
import { installFetchPatch } from "./patchFetch.js";
import { installHttpPatch } from "./patchHttp.js";
import { installUndiciFetchAlias } from "./patchUndici.js";

let engine: MonitorEngine | null = null;
let uninstallFetch: (() => void) | null = null;
let uninstallHttp: (() => void) | null = null;
let uninstallAxios: (() => void) | null = null;
let uninstallUndici: (() => void) | null = null;

/**
 * Install global fetch / HTTP instrumentation and a dedicated {@link MonitorEngine}.
 * Idempotent: returns the existing engine if already started.
 */
export function startSpectyraAuto(opts: SpectyraAutoStartOptions = {}): MonitorEngine {
  if (engine) return engine;

  const cfg = resolveAutoConfig(opts);
  void startPricingRuntime({});

  const cloudSyncOn =
    opts.cloudSync === true ||
    (typeof process !== "undefined" && process.env.SPECTYRA_CLOUD_SYNC === "true");
  const cloudConfig: SpectyraConfig = {
    spectyraCloudApiKey: opts.spectyraCloudApiKey,
    spectyraApiBaseUrl: opts.spectyraApiBaseUrl,
    projectId: cfg.project,
    analytics: {
      enabled: true,
      cloudSync: cloudSyncOn,
    },
  };
  const cloudDebouncer = shouldSyncMonitorToCloud(cloudConfig)
    ? createMonitorCloudSyncDebouncer(cloudConfig, () => (engine ? engine.getEventsSnapshot() : []))
    : null;

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
    onAfterRecord: cloudDebouncer ? () => cloudDebouncer.schedule() : undefined,
  });

  const get = () => engine;
  const defaults = { project: cfg.project, environment: cfg.environment, service: cfg.service };
  uninstallFetch = installFetchPatch(get, defaults);
  uninstallUndici = installUndiciFetchAlias();
  uninstallHttp = installHttpPatch(get, defaults);
  uninstallAxios = installAxiosInterceptor(get, defaults);

  return engine;
}

export function stopSpectyraAuto(): void {
  uninstallFetch?.();
  uninstallUndici?.();
  uninstallHttp?.();
  uninstallAxios?.();
  uninstallFetch = uninstallUndici = uninstallHttp = uninstallAxios = null;
  engine = null;
}

export function getAutoMonitorEngine(): MonitorEngine | null {
  return engine;
}
