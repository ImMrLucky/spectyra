/**
 * Shared helpers for adapter implementations.
 * Token estimation, ID generation, default metadata.
 */

import type {
  CanonicalSecurityMetadata,
  CanonicalExecutionMetadata,
} from "@spectyra/canonical-model";

let idCounter = 0;
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function defaultSecurity(): CanonicalSecurityMetadata {
  return {
    telemetryMode: "local",
    promptSnapshotMode: "local_only",
    localOnly: true,
  };
}

export function defaultExecution(): CanonicalExecutionMetadata {
  return {};
}
