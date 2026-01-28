export interface ScenarioTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * RequiredCheck - Canonical interface
 * Used by packages/shared/src/scenarioSchema.ts
 */
export interface RequiredCheck {
  name: string;
  type: "regex";
  pattern: string;
  flags?: string; // Optional flags for regex
}

/**
 * RequiredCheck - Union type for quality guard
 * Used by apps/api/src/services/optimizer/quality/qualityGuard.ts
 */
export type RequiredCheckType = RequiredCheck;

/**
 * Scenario - Canonical interface (all fields required)
 * Used by packages/shared/src/scenarioSchema.ts
 */
export interface Scenario {
  id: string;
  path: "talk" | "code";
  title: string;
  turns: ScenarioTurn[];
  required_checks: RequiredCheck[];
}

/**
 * Scenario - DTO for web API (optional fields)
 * Used by apps/web/src/app/core/api/models.ts
 */
export interface ScenarioDTO {
  id: string;
  path: "talk" | "code";
  title: string;
  turns?: ScenarioTurn[];
  required_checks?: RequiredCheck[];
}
