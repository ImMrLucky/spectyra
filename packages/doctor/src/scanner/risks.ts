import type { DoctorScanReport, DoctorRisk, SpectyraStatus } from "./types.js";
import { classifyModelHint } from "./modelClassifier.js";

export function buildDoctorRisks(report: DoctorScanReport, spectyra: SpectyraStatus): DoctorRisk[] {
  const risks: DoctorRisk[] = [];

  if (report.aiFindings.length && !spectyra.sdkInstalled) {
    risks.push({
      level: "high",
      title: "LLM usage without Spectyra SDK",
      detail: "Calls were detected but `@spectyra/sdk` is not installed in the relevant package.json files.",
      fix: "npm install @spectyra/sdk (per package that owns the LLM code)",
    });
  }

  const browserish = report.aiFindings.filter(
    (f) =>
      f.relativePath.includes("apps/web") ||
      f.relativePath.includes("src/components") ||
      /\.(tsx|vue|svelte)$/.test(f.relativePath),
  );
  if (browserish.length) {
    risks.push({
      level: "medium",
      title: "Possible client-side AI usage",
      detail: "Some findings live in frontend-looking paths. Avoid exposing provider keys in the browser.",
      filePath: browserish[0]?.relativePath,
      line: browserish[0]?.line,
    });
  }

  for (const f of report.aiFindings) {
    for (const mh of f.modelHints) {
      const c = classifyModelHint(mh);
      if (c.costProfile === "high") {
        risks.push({
          level: "low",
          title: "Higher-cost model reference",
          detail: mh,
          filePath: f.relativePath,
          line: f.line,
          fix: "Consider routing low-value prompts to a smaller model; confirm with runtime monitoring.",
        });
      }
    }
  }

  const providers = new Set(report.aiFindings.map((f) => f.provider));
  if (providers.size >= 4) {
    risks.push({
      level: "medium",
      title: "Many providers detected",
      detail: "Multiple LLM vendors in one codebase — centralize behind one gateway when possible.",
    });
  }

  return risks.slice(0, 25);
}
