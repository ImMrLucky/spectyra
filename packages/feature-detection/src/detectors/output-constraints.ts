/**
 * Output/safety constraint detectors.
 *
 * Identifies situations where certain transforms must be avoided or
 * constrained due to output requirements (exact JSON, code, determinism,
 * section preservation).
 */

import type {
  CanonicalRequest,
  FeatureDetector,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

export const jsonOutputRequiredDetector: FeatureDetector = {
  id: "output_constraints/json_required",
  category: "output_constraints",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (input.policies?.desiredOutputShape === "json") {
      return [{ featureId: "output_constraints/json_required", confidence: 1, severity: "high" }];
    }
    const sysText = input.messages.filter(m => m.role === "system").map(m => m.text ?? "").join(" ").toLowerCase();
    if (sysText.includes("respond in json") || sysText.includes("output json") || sysText.includes("return json")) {
      return [{ featureId: "output_constraints/json_required", confidence: 0.8, severity: "high" }];
    }
    return [];
  },
};

export const codeOutputRequiredDetector: FeatureDetector = {
  id: "output_constraints/code_required",
  category: "output_constraints",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (input.policies?.desiredOutputShape === "code") {
      return [{ featureId: "output_constraints/code_required", confidence: 1, severity: "high" }];
    }
    return [];
  },
};

export const determinismRequiredDetector: FeatureDetector = {
  id: "output_constraints/determinism_required",
  category: "output_constraints",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (input.policies?.prioritizeDeterminism) {
      return [{ featureId: "output_constraints/determinism_required", confidence: 1, severity: "medium" }];
    }
    return [];
  },
};

export const recentTurnsPreservedDetector: FeatureDetector = {
  id: "safety_constraints/recent_turns_preserved",
  category: "safety_constraints",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (input.policies?.keepRecentTurns) {
      return [{
        featureId: "safety_constraints/recent_turns_preserved",
        confidence: 1,
        severity: "high",
        metrics: { keepRecentTurns: input.policies.keepRecentTurns },
      }];
    }
    return [];
  },
};

export const exactSectionsPreservedDetector: FeatureDetector = {
  id: "safety_constraints/exact_sections_preserved",
  category: "safety_constraints",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (input.policies?.preserveExactSections?.length) {
      return [{
        featureId: "safety_constraints/exact_sections_preserved",
        confidence: 1,
        severity: "high",
        evidence: input.policies.preserveExactSections,
      }];
    }
    return [];
  },
};

export const sensitiveContentDetector: FeatureDetector = {
  id: "safety_constraints/sensitive_content",
  category: "safety_constraints",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (input.security.containsSensitiveContent) {
      return [{ featureId: "safety_constraints/sensitive_content", confidence: 1, severity: "high" }];
    }
    return [];
  },
};

export const outputConstraintDetectors: FeatureDetector[] = [
  jsonOutputRequiredDetector,
  codeOutputRequiredDetector,
  determinismRequiredDetector,
  recentTurnsPreservedDetector,
  exactSectionsPreservedDetector,
  sensitiveContentDetector,
];
