import type { SpectyraConfig } from "../types.js";
import type { SpectyraMonitorEvent } from "../monitor/monitorTypes.js";
import { flushMonitorEventsToCloud } from "./monitorSync.js";
import { resolveSpectyraCloudApiKey } from "./resolveSpectyraCloudApiKey.js";
import { resolveSpectyraApiBaseUrl } from "../entitlements/resolveApiBaseUrl.js";

function resolveApiBase(config: SpectyraConfig): string {
  return resolveSpectyraApiBaseUrl(config);
}

export function shouldSyncMonitorToCloud(config: SpectyraConfig): boolean {
  const key = resolveSpectyraCloudApiKey(config);
  if (!key) return false;
  if (config.analytics?.enabled === false) return false;
  if (typeof process !== "undefined" && process.env.SPECTYRA_CLOUD_SYNC === "true") return true;
  if (config.analytics?.cloudSync === true) return true;
  return false;
}

/**
 * Debounced flush of new monitor rows since last successful flush. Fail-open.
 */
export function createMonitorCloudSyncDebouncer(config: SpectyraConfig, getSnapshot: () => SpectyraMonitorEvent[]) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushedLen = 0;

  function schedule(): void {
    if (!shouldSyncMonitorToCloud(config)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void (async () => {
        try {
          const snap = getSnapshot();
          if (snap.length <= flushedLen) return;
          const batch = snap.slice(flushedLen);
          flushedLen = snap.length;
          const base = resolveApiBase(config);
          if (batch.length === 0) return;
          const key = resolveSpectyraCloudApiKey(config);
          if (!key) return;
          await flushMonitorEventsToCloud({
            baseUrl: base,
            apiKey: key,
            project: config.projectId,
            events: batch.slice(-200),
          });
        } catch {
          /* fail open */
        }
      })();
    }, 5000);
  }

  return { schedule };
}
