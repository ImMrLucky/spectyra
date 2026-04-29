import type { SpectyraCompleteResult } from "../types.js";
import type { SpectyraQuotaStatus } from "../observability/observabilityTypes.js";
import type { SpectyraRunMode } from "@spectyra/core-types";

/**
 * One-line safe debug log after `complete()` — no prompts, messages, or secrets.
 */
export function logSpectyraDebugSafeLine(args: {
  effectiveMode: SpectyraRunMode;
  passthroughFromQuota: boolean;
  quota: SpectyraQuotaStatus | null;
  out: SpectyraCompleteResult<unknown>;
  traceId: string;
}): void {
  const { effectiveMode, passthroughFromQuota, quota, out, traceId } = args;
  const rep = out.report;
  const id = traceId || rep.runId || "unknown";

  if (out.licenseLimited) {
    // eslint-disable-next-line no-console -- intentional dev/QA opt-in only
    console.log(`[Spectyra] passthrough: license_limited · traceId=${id}`);
    return;
  }

  if (effectiveMode === "off" || passthroughFromQuota) {
    let reason = "optimization_off";
    if (passthroughFromQuota || (quota && !quota.canRunOptimized)) {
      reason = quota?.state ? `quota:${quota.state}` : "quota";
    } else if (effectiveMode === "off") {
      reason = "run_mode_off";
    }
    // eslint-disable-next-line no-console -- intentional dev/QA opt-in only
    console.log(`[Spectyra] passthrough: ${reason} · traceId=${id}`);
    return;
  }

  const pct = Number.isFinite(rep.estimatedSavingsPct) ? rep.estimatedSavingsPct.toFixed(0) : "?";
  const usd = Number.isFinite(rep.estimatedSavings) ? rep.estimatedSavings.toFixed(2) : "?";
  // eslint-disable-next-line no-console -- intentional dev/QA opt-in only
  console.log(`[Spectyra] optimized request: saved ${pct}%, estimated $${usd} · traceId=${id}`);
}
