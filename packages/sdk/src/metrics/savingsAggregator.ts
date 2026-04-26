import type { SpectyraSessionState } from "../observability/spectyraSessionState.js";
import type { SpectyraSessionCostSummary, SpectyraSavingsSummary } from "../observability/observabilityTypes.js";

/**
 * Convenience rollups over {@link SpectyraSessionState} for dashboards and hooks.
 * @public
 */
export function getSavingsSummaryFromSession(session: SpectyraSessionState): SpectyraSavingsSummary {
  return session.getSavingsSummary();
}

/** @public */
export function getSessionCostSummaryFromSession(session: SpectyraSessionState): SpectyraSessionCostSummary {
  return session.getSessionCostSummary();
}
