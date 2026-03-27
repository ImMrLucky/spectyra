import type { SpectyraEvent } from "@spectyra/event-core";
import type { TelemetryMode, PromptSnapshotMode } from "@spectyra/core-types";

export function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function defaultSecurity(
  telemetryMode: TelemetryMode = "local",
  promptSnapshotMode: PromptSnapshotMode = "local_only",
): SpectyraEvent["security"] {
  return {
    telemetryMode,
    promptSnapshotMode,
    localOnly: true,
    containsPromptContent: false,
    containsResponseContent: false,
  };
}
