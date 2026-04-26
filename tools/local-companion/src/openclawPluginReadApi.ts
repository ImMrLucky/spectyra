/**
 * Read-only HTTP routes for the Spectyra OpenClaw plugin.
 * Exposes already-persisted savings from local runs.jsonl — no new optimization logic.
 */

import type { Express, Request, Response } from "express";
import type { SavingsReport } from "@spectyra/core-types";
import { getCachedBillingAllowsRealSavings } from "./billingEntitlement.js";
import { loadConfig, type CompanionConfig } from "./config.js";
import { getRuns } from "./localStore.js";
import { companionPackageVersion } from "./packageVersion.js";
import { isProviderKeyConfigured } from "./providers.js";

function savingsEnabledSnapshot(snap: CompanionConfig, companionReady: boolean): boolean {
  const billingAllows = snap.spectyraAccountLinked && getCachedBillingAllowsRealSavings() === true;
  return snap.openclawFreeMode
    ? snap.optimizationRunMode === "on" && snap.runMode === "on" && companionReady
    : Boolean(
        snap.spectyraAccountLinked &&
          snap.optimizationRunMode === "on" &&
          snap.runMode === "on" &&
          billingAllows &&
          companionReady,
      );
}

/** Map a persisted run to the OpenClaw plugin "latest" JSON contract. */
export function savingsReportToOpenClawLatest(r: SavingsReport): Record<string, unknown> {
  const outTok = r.outputTokens ?? 0;
  return {
    ok: true,
    traceId: r.runId,
    flowId: r.sessionId ?? r.sessionKey ?? r.runId,
    timestamp: r.createdAt ?? new Date().toISOString(),
    model: r.model,
    percentSaved: r.estimatedSavingsPct,
    estimatedCostBefore: r.estimatedCostBefore,
    estimatedCostAfter: r.estimatedCostAfter,
    estimatedCostSaved: r.estimatedSavings,
    inputTokensBefore: r.inputTokensBefore,
    inputTokensAfter: r.inputTokensAfter,
    outputTokensBefore: outTok,
    outputTokensAfter: outTok,
    transformsApplied: r.transformsApplied ?? [],
  };
}

function buildFlowsLatestPayload(runs: SavingsReport[]): Record<string, unknown> | null {
  if (runs.length === 0) {
    return null;
  }
  const newest = runs[runs.length - 1];
  const key = newest.sessionId ?? newest.sessionKey ?? "";
  const group = key ? runs.filter((x) => (x.sessionId ?? x.sessionKey ?? "") === key) : [newest];
  let inB = 0;
  let inA = 0;
  let outTok = 0;
  let costB = 0;
  let costA = 0;
  let saved = 0;
  let optimized = 0;
  for (const r of group) {
    inB += r.inputTokensBefore;
    inA += r.inputTokensAfter;
    outTok += r.outputTokens ?? 0;
    costB += r.estimatedCostBefore;
    costA += r.estimatedCostAfter;
    saved += r.estimatedSavings;
    if ((r.estimatedSavingsPct ?? 0) > 0 || (r.inputTokensBefore - r.inputTokensAfter) > 0) {
      optimized += 1;
    }
  }
  const pct = inB > 0 ? ((inB - inA) / inB) * 100 : 0;
  return {
    ok: true,
    flowId: key || newest.runId,
    totalInputTokensBefore: inB,
    totalInputTokensAfter: inA,
    totalOutputTokensBefore: outTok,
    totalOutputTokensAfter: outTok,
    estimatedCostBefore: costB,
    estimatedCostAfter: costA,
    estimatedCostSaved: saved,
    percentSaved: pct,
    stepsOptimized: optimized,
    totalSteps: group.length,
  };
}

export function registerOpenClawPluginReadRoutes(app: Express): void {
  app.get("/openclaw/v1/latest", async (_req: Request, res: Response) => {
    try {
      const runs = await getRuns(120);
      if (runs.length === 0) {
        res.json({ ok: false, reason: "no_recent_result" });
        return;
      }
      const last = runs[runs.length - 1];
      res.json(savingsReportToOpenClawLatest(last));
    } catch {
      res.status(500).json({ ok: false, reason: "error" });
    }
  });

  app.get("/openclaw/v1/recent", async (req: Request, res: Response) => {
    try {
      const lim = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));
      const runs = await getRuns(200);
      const tail = runs.slice(-lim);
      const items = [...tail].reverse().map((r) => savingsReportToOpenClawLatest(r));
      res.json({ ok: true, items });
    } catch {
      res.status(500).json({ ok: false, reason: "error" });
    }
  });

  app.get("/openclaw/v1/flows/latest", async (_req: Request, res: Response) => {
    try {
      const runs = await getRuns(200);
      const payload = buildFlowsLatestPayload(runs);
      if (!payload) {
        res.json({ ok: false, reason: "no_flow" });
        return;
      }
      res.json(payload);
    } catch {
      res.status(500).json({ ok: false, reason: "error" });
    }
  });

  app.get("/openclaw/v1/status", (_req: Request, res: Response) => {
    const snap = loadConfig();
    const pc = isProviderKeyConfigured(snap.provider);
    res.json({
      ok: true,
      service: "spectyra-local-companion",
      packageVersion: companionPackageVersion(),
      runMode: snap.runMode,
      optimizationRunMode: snap.optimizationRunMode,
      openclawFreeMode: snap.openclawFreeMode,
      companionReady: pc,
      savingsEnabled: savingsEnabledSnapshot(snap, pc),
    });
  });
}
