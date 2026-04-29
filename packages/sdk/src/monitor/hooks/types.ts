import type { SpectyraMonitorEvent } from "../monitorTypes.js";

/**
 * Metadata-only monitor sink (same contract as `SpectyraInstance.recordMonitorEvent`).
 * @public
 */
export type SpectyraFrameworkMonitorRecord = (
  partial: Partial<SpectyraMonitorEvent> & Pick<SpectyraMonitorEvent, "provider" | "latencyMs" | "success">,
) => void;
