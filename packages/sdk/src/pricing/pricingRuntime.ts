import type { SpectyraConfig } from "../types.js";
import { resolveSpectyraCloudApiKey } from "../cloud/resolveSpectyraCloudApiKey.js";
import { resolveSpectyraApiBaseUrl } from "../entitlements/resolveApiBaseUrl.js";
import { createSpectyraLogger } from "../observability/spectyraLogger.js";
import { fetchPricingSnapshot } from "./pricingClient.js";
import type { ProviderPricingSnapshot } from "./types.js";

export interface PricingSnapshotMeta {
  version: string;
  fetchedAt: string;
  stale: boolean;
  ttlSeconds: number;
}

let snapshot: ProviderPricingSnapshot | null = null;
let fetchedAtMs = 0;

export function getPricingSnapshot(): ProviderPricingSnapshot | null {
  return snapshot;
}

export function getPricingSnapshotMeta(): PricingSnapshotMeta {
  if (!snapshot) {
    return { version: "", fetchedAt: "", stale: true, ttlSeconds: 0 };
  }
  const ageSec = (Date.now() - fetchedAtMs) / 1000;
  const stale = ageSec > snapshot.ttlSeconds;
  return {
    version: snapshot.version,
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    stale,
    ttlSeconds: snapshot.ttlSeconds,
  };
}

function pricingEnabled(config: SpectyraConfig): boolean {
  if (config.pricing?.enabled === false) return false;
  if (config.pricing?.enabled === true) return true;
  const k = resolveSpectyraCloudApiKey(config);
  const b = resolveSpectyraApiBaseUrl(config);
  return Boolean(k && b);
}

function intervalMs(config: SpectyraConfig): number {
  return config.pricing?.refreshIntervalMs ?? 600_000;
}

export function startPricingRuntime(config: SpectyraConfig): { stop: () => void; refresh: () => Promise<void> } {
  const log = createSpectyraLogger(config);
  if (!pricingEnabled(config)) {
    return { stop: () => {}, refresh: async () => {} };
  }
  const key = resolveSpectyraCloudApiKey(config);
  const base = resolveSpectyraApiBaseUrl(config);
  if (!key || !base) {
    return { stop: () => {}, refresh: async () => {} };
  }

  let timer: ReturnType<typeof setInterval> | undefined;

  const applyStaleCallback = () => {
    const meta = getPricingSnapshotMeta();
    if (!meta.version) return;
    const warnAfter = config.pricing?.staleWarnSeconds ?? meta.ttlSeconds;
    if (meta.stale) {
      try {
        config.onPricingStale?.({
          version: meta.version,
          fetchedAt: meta.fetchedAt,
          stale: meta.stale,
        });
      } catch (e) {
        log.error("onPricingStale failed", { error: String(e) });
      }
      log.warn("pricing snapshot is stale; using last known good", { version: meta.version });
    } else if ((Date.now() - fetchedAtMs) / 1000 > warnAfter * 0.9) {
      log.log("pricing", "snapshot approaching TTL", { version: meta.version });
    }
  };

  const refresh = async () => {
    try {
      const row = await fetchPricingSnapshot(base, key);
      snapshot = row;
      fetchedAtMs = Date.now();
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(
            "spectyra.pricing.snapshot",
            JSON.stringify({ at: fetchedAtMs, body: row }),
          );
        }
      } catch {
        /* ignore */
      }
      log.log("pricing", "snapshot refreshed", { version: row.version, entries: row.entries.length });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      log.warn("pricing refresh failed; keeping last snapshot", { error: err });
      try {
        if (typeof localStorage !== "undefined" && !snapshot) {
          const raw = localStorage.getItem("spectyra.pricing.snapshot");
          if (raw) {
            const parsed = JSON.parse(raw) as { body: ProviderPricingSnapshot };
            snapshot = parsed.body;
            fetchedAtMs = Date.now() - 86_400_000;
          }
        }
      } catch {
        /* ignore */
      }
    }
    applyStaleCallback();
  };

  void refresh().catch(() => {});

  if (typeof setInterval !== "undefined") {
    const ms = intervalMs(config);
    if (ms > 0) {
      timer = setInterval(() => {
        void refresh().catch(() => {});
      }, ms);
    }
  }

  return {
    stop: () => {
      if (timer) clearInterval(timer);
    },
    refresh,
  };
}
