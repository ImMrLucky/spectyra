import type {
  CompanionHealthResponse,
  CompanionModelsResponse,
  OpenClawWizardBlocker,
  OpenClawWizardStatus,
  SpectyraLocalConnectionState,
} from "./types.js";

export function deriveOpenClawWizardStatus(
  health: CompanionHealthResponse,
  models: CompanionModelsResponse,
): OpenClawWizardStatus {
  let blocker: OpenClawWizardBlocker = "none";
  if (health.reachability === "unreachable") {
    blocker = "companion_unreachable";
  } else if (health.providerConfigured === false) {
    blocker = "provider_not_configured";
  } else if (health.readiness !== "ready") {
    blocker = "companion_not_ready";
  } else if (!models.ok || models.modelIds.length === 0) {
    blocker = "companion_not_ready";
  }

  return { blocker, health, models };
}

/**
 * Map health + optional desktop hints to a single UI state.
 * `signedIn` should reflect Spectyra account when available; omit when unknown.
 */
export function deriveSpectyraLocalConnectionState(
  health: CompanionHealthResponse,
  opts?: { signedIn?: boolean; desktopAppLikelyRunning?: boolean },
): SpectyraLocalConnectionState {
  if (opts?.desktopAppLikelyRunning === false) {
    return "companion_unreachable";
  }
  if (health.reachability === "unreachable") {
    return "companion_unreachable";
  }
  if (health.readiness !== "ready") {
    return "companion_not_ready";
  }
  if (opts?.signedIn === false) {
    return "license_or_account_incomplete";
  }
  if (health.providerConfigured === false) {
    return "provider_missing";
  }
  return "ready";
}
