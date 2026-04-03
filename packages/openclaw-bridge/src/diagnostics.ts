import { checkCompanionHealth } from "./health-check.js";
import { checkCompanionModels } from "./models-check.js";
import { deriveOpenClawWizardStatus } from "./wizard-status.js";
import type { OpenClawWizardStatus } from "./types.js";

/**
 * Runs health + models probes against Local Companion. No prompt payload.
 *
 * @param companionOrigin e.g. `http://127.0.0.1:4111` (no trailing path)
 */
export async function runLocalCompanionDiagnostics(
  companionOrigin: string,
  init?: RequestInit,
): Promise<OpenClawWizardStatus> {
  const origin = companionOrigin.replace(/\/$/, "");
  const v1Base = `${origin}/v1`;
  const [health, models] = await Promise.all([checkCompanionHealth(origin, init), checkCompanionModels(v1Base, init)]);
  return deriveOpenClawWizardStatus(health, models);
}
