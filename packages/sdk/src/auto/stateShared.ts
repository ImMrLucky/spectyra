import {
  createMonitorCloudSyncDebouncer,
  shouldSyncMonitorToCloud,
} from "../cloud/monitorCloudSyncDebouncer.js";
import { createMonitorEngine, type MonitorEngine } from "../monitor/monitorEngine.js";
import { startPricingRuntime } from "../pricing/pricingRuntime.js";
import type { SpectyraConfig } from "../types.js";
import { resolveAutoConfig, type ResolvedAutoConfig, type SpectyraAutoStartOptions } from "./config.js";
import { installAxiosInterceptor } from "./patchAxios.js";
import { installFetchPatch } from "./patchFetch.js";

let engine: MonitorEngine | null = null;
let uninstallFetch: (() => void) | null = null;
let uninstallNodePatches: (() => void) | null = null;
let uninstallAxios: (() => void) | null = null;
let lastResolved: ResolvedAutoConfig | null = null;

export type SpectyraAutoHandle = MonitorEngine;

export interface SpectyraAutoState {
  running: boolean;
  project?: string;
  environment?: string;
  service?: string;
  jsonlEnabled?: boolean;
  consoleEnabled?: boolean;
  overlayEnabled?: boolean;
}

export function getSpectyraAutoState(): SpectyraAutoState {
  return {
    running: Boolean(engine),
    project: lastResolved?.project,
    environment: lastResolved?.environment,
    service: lastResolved?.service,
    jsonlEnabled: lastResolved?.jsonl.enabled,
    consoleEnabled: lastResolved?.consoleEnabled,
    overlayEnabled: lastResolved?.overlayEnabled,
  };
}

/** Installs Node-only HTTP + undici patches; returns a single uninstaller. */
export type NodePatchInstaller = (
  getEngine: () => MonitorEngine | null,
  defaults: { project?: string; environment?: string; service?: string },
) => () => void;

/**
 * Install global fetch / HTTP instrumentation and a dedicated {@link MonitorEngine}.
 * Idempotent: returns the existing engine if already started.
 */
export function startSpectyraAutoInternal(
  opts: SpectyraAutoStartOptions = {},
  nodePatchInstaller?: NodePatchInstaller,
): MonitorEngine {
  if (engine) return engine;

  const cfg = resolveAutoConfig(opts);
  lastResolved = cfg;
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
  uninstallAxios = installAxiosInterceptor(get, defaults);

  if (nodePatchInstaller) {
    uninstallNodePatches = nodePatchInstaller(get, defaults);
  }

  return engine;
}

export function stopSpectyraAuto(): void {
  uninstallFetch?.();
  uninstallNodePatches?.();
  uninstallAxios?.();
  uninstallFetch = uninstallNodePatches = uninstallAxios = null;
  engine = null;
  lastResolved = null;
}

export function getAutoMonitorEngine(): MonitorEngine | null {
  return engine;
}
