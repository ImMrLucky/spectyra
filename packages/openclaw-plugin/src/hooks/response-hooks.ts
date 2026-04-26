import type { CompanionClient } from "../companion/companion-client.js";
import type { SeamlessSavingsOptions } from "../ui/spectyra-savings-badge.js";
import {
  buildSavingsBadgeDescriptor,
  resolveSavingsBadgeView,
} from "../ui/spectyra-savings-badge.js";
import type { SavingsBadgeDescriptor } from "../ui/spectyra-savings-badge.js";

export interface ResponseHookDeps {
  companion: CompanionClient;
  optimizationEnabled: () => boolean;
  seamless?: SeamlessSavingsOptions;
  /** Called after a non-null inline savings view is produced (dedupe by traceId). */
  onInlineSavingsShown?: (traceId: string) => void;
}

export async function afterAssistantResponse(
  ctx: Record<string, unknown> | undefined,
  deps: ResponseHookDeps,
): Promise<SavingsBadgeDescriptor | null> {
  if (!deps.optimizationEnabled()) {
    return null;
  }
  const view = await resolveSavingsBadgeView(deps.companion, ctx, deps.seamless);
  if (!view) {
    return null;
  }
  deps.onInlineSavingsShown?.(view.traceId);
  return buildSavingsBadgeDescriptor(view);
}
