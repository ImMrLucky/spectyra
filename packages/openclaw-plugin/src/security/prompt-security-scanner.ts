import { redactPreview } from "../utils/redact.js";
import { recommendedActionsForCategories } from "./security-recommended-actions.js";
import { SECURITY_RULES } from "./security-rules.js";
import type {
  PromptSecurityScanResult,
  ScanPromptOptions,
  SecurityFinding,
  SecurityLevel,
} from "./security-types.js";

const LEVEL_ORDER: SecurityLevel[] = ["info", "low", "medium", "high", "critical"];

function rank(s: SecurityLevel): number {
  return LEVEL_ORDER.indexOf(s);
}

function maxLevel(levels: SecurityLevel[]): SecurityLevel {
  let best: SecurityLevel = "info";
  for (const s of levels) {
    if (rank(s) > rank(best)) {
      best = s;
    }
  }
  return best;
}

function bumpSensitivity(ruleSeverity: SecurityLevel, mode: NonNullable<ScanPromptOptions["sensitivity"]>): SecurityLevel {
  if (mode === "strict") {
    return ruleSeverity === "info" ? "low" : ruleSeverity === "low" ? "medium" : ruleSeverity;
  }
  if (mode === "permissive") {
    if (ruleSeverity === "info" || ruleSeverity === "low") return "info";
    if (ruleSeverity === "medium") return "low";
    return ruleSeverity;
  }
  return ruleSeverity;
}

function computeScore(findings: SecurityFinding[]): number {
  let s = 0;
  for (const f of findings) {
    s += (rank(f.severity) + 1) * 12;
  }
  return Math.min(100, s);
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return !(a[1] <= b[0] || b[1] <= a[0]);
}

function buildScanResult(findings: SecurityFinding[], text: string): PromptSecurityScanResult {
  const level = findings.length === 0 ? "info" : maxLevel(findings.map((f) => f.severity));
  const cats = findings.map((f) => f.category);
  return {
    level,
    score: computeScore(findings),
    findings,
    sanitizedPreview: findings.length ? redactPreview(text.slice(0, 400)) : undefined,
    advisoryOnly: true,
    recommendedActions: recommendedActionsForCategories(cats),
  };
}

export function scanPromptSecurity(text: string, options: ScanPromptOptions = {}): PromptSecurityScanResult {
  const sensitivity = options.sensitivity ?? "balanced";
  const largeThreshold = options.largePasteThreshold ?? 8000;
  const findings: SecurityFinding[] = [];
  const used: [number, number][] = [];

  if (text.length >= largeThreshold) {
    findings.push({
      id: `large_paste_${used.length}`,
      label: "Large pasted content",
      description: "Very large pasted content — review before sending",
      severity: bumpSensitivity("medium", sensitivity),
      category: "large_private_context",
      matchPreview: redactPreview(text.slice(0, 64)),
    });
    used.push([0, Math.min(text.length, 120)]);
  }

  for (const rule of SECURITY_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : `${rule.re.flags}g`);
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      const span: [number, number] = [start, end];
      if (used.some((u) => overlaps(u, span))) {
        continue;
      }
      const raw = m[0];
      const sev = bumpSensitivity(rule.severity, sensitivity);
      findings.push({
        id: `${rule.id}_${start}`,
        label: rule.summary,
        description: rule.summary,
        severity: sev,
        category: rule.category,
        matchPreview: redactPreview(raw.slice(0, 48)),
      });
      used.push(span);
    }
  }

  return buildScanResult(findings, text);
}

/** @alias scanPromptSecurity — kept for compatibility */
export const scanPrompt = scanPromptSecurity;

export function mergePromptScanResults(base: PromptSecurityScanResult, extra: SecurityFinding[]): PromptSecurityScanResult {
  const findings = [...base.findings, ...extra];
  const level = findings.length === 0 ? "info" : maxLevel(findings.map((f) => f.severity));
  const cats = findings.map((f) => f.category);
  return {
    level,
    score: computeScore(findings),
    findings,
    sanitizedPreview: base.sanitizedPreview,
    advisoryOnly: true,
    recommendedActions: recommendedActionsForCategories(cats),
  };
}

export function buildSecurityScanEventPayload(input: {
  messageId?: string;
  flowId?: string;
  result: PromptSecurityScanResult;
}): Record<string, unknown> {
  const { findings } = input.result;
  return {
    kind: "spectyra.security_scan",
    messageId: input.messageId,
    flowId: input.flowId,
    findingIds: findings.map((f) => f.id),
    categories: findings.map((f) => f.category),
    severities: findings.map((f) => f.severity),
    level: input.result.level,
    score: input.result.score,
    advisoryOnly: true,
    recommendedActions: input.result.recommendedActions,
    count: findings.length,
  };
}

export function buildToolRiskEventPayload(input: {
  flowId?: string;
  messageId?: string;
  toolName: string;
  level: SecurityLevel;
}): Record<string, unknown> {
  return {
    kind: "spectyra.tool_risk",
    flowId: input.flowId,
    messageId: input.messageId,
    toolName: input.toolName,
    level: input.level,
    advisoryOnly: true,
  };
}
