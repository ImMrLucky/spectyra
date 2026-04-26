import type { CompanionClient } from "../companion/companion-client.js";
import { openClawLatestOkToView, SPECTYRA_COMPANION_BASE } from "../companion/companion-client.js";
import { isFreshOpenClawTimestamp } from "../companion/seamless-helpers.js";
import { SafeLogger } from "../utils/safe-logger.js";
import { formatFlowSummarySpectyraBlock, resolveFlowSummary } from "../ui/spectyra-flow-summary.js";
import { buildStatusPanelDescriptor, formatSpectyraStatusMarkdown } from "../ui/spectyra-status-panel.js";
import { formatSavingsBadgeLabel } from "../ui/spectyra-savings-badge.js";

const log = new SafeLogger();

export interface CommandContext {
  companion: CompanionClient;
  getOptimizationEnabled: () => boolean;
  setOptimizationEnabled: (v: boolean) => void;
  getSecurityWarningsEnabled: () => boolean;
  setSecurityWarningsEnabled: (v: boolean) => void;
  /** Optional host hook to open external URLs (no shell). */
  openExternal?: (url: string) => void | Promise<void>;
  showMessage?: (text: string) => void;
}

export async function runSpectyraStatus(ctx: CommandContext): Promise<string> {
  const state = await ctx.companion.connectionState();
  const desc = buildStatusPanelDescriptor({
    state,
    optimizationEnabled: ctx.getOptimizationEnabled(),
    securityWarningsEnabled: ctx.getSecurityWarningsEnabled(),
    companionBase: SPECTYRA_COMPANION_BASE,
  });
  let latestLine: string | null = null;
  let flowMd: string | null = null;
  if (state.reachable) {
    const latest = await ctx.companion.getOpenClawLatest();
    if (latest && latest.ok === true && isFreshOpenClawTimestamp(latest.timestamp)) {
      latestLine = formatSavingsBadgeLabel(openClawLatestOkToView(latest));
    }
    const flow = await resolveFlowSummary(ctx.companion, undefined);
    if (flow) {
      flowMd = formatFlowSummarySpectyraBlock(flow);
    }
  }
  const text = formatSpectyraStatusMarkdown(desc, {
    latestSavingsLine: latestLine,
    flowSummaryMarkdown: flowMd,
  });
  ctx.showMessage?.(text);
  return text;
}

export function runSpectyraEnable(ctx: CommandContext): string {
  ctx.setOptimizationEnabled(true);
  const msg = "Spectyra optimization enabled (UI hints).";
  ctx.showMessage?.(msg);
  log.info("spectyra.enable", {});
  return msg;
}

export function runSpectyraDisable(ctx: CommandContext): string {
  ctx.setOptimizationEnabled(false);
  const msg = "Spectyra optimization disabled (inline savings hidden).";
  ctx.showMessage?.(msg);
  log.info("spectyra.disable", {});
  return msg;
}

export async function runSpectyraOpenDashboard(ctx: CommandContext): Promise<string> {
  const url = `${SPECTYRA_COMPANION_BASE}/dashboard`;
  if (ctx.openExternal) {
    await ctx.openExternal(url);
    return `Opened ${url}`;
  }
  const msg = `Open dashboard: ${url}`;
  ctx.showMessage?.(msg);
  return msg;
}

export const SPECTYRA_COMMAND_IDS = [
  "spectyra.status",
  "spectyra.enable",
  "spectyra.disable",
  "spectyra.openDashboard",
] as const;
