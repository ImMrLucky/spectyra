import type { DoctorScanResult } from "./types.js";

export interface VerifyLine {
  ok: boolean;
  label: string;
  detail?: string;
}

export function verifyIntegration(result: DoctorScanResult): VerifyLine[] {
  const lines: VerifyLine[] = [];
  const s = result.spectyraStatus;

  lines.push({
    ok: s.autoInstalled,
    label: "@spectyra/auto installed",
    detail: s.autoInstalled ? undefined : "Add dependency in the package that runs LLM calls",
  });
  lines.push({
    ok: s.devtoolsInstalled,
    label: "@spectyra/devtools installed (optional overlay)",
  });
  lines.push({
    ok: s.autoImportFiles.length > 0,
    label: "Spectyra import found in scanned sources",
    detail: s.autoImportFiles[0],
  });
  lines.push({
    ok: s.hasStartSpectyraAuto || s.autoImportFiles.some((f) => f.length > 0),
    label: "startSpectyraAuto(...) or side-effect import",
  });
  lines.push({
    ok: !s.devtoolsImportFiles.length || s.hasDevBridge,
    label: "Dev bridge (required if browser overlay reads API)",
    detail:
      s.devtoolsImportFiles.length && !s.hasDevBridge
        ? "Add useSpectyraAutoDevBridge when using devtools overlay"
        : undefined,
  });
  lines.push({
    ok: result.aiCallSites.length > 0,
    label: "AI call sites detected in scan",
    detail: result.aiCallSites.length ? `${result.aiCallSites.length} site(s)` : "None found — verify paths or add LLM code",
  });
  lines.push({
    ok: !s.possibleLateImport,
    label: "Import order (Spectyra before heavy imports)",
    detail: s.possibleLateImport ? "Warning: Spectyra may load late" : undefined,
  });

  return lines;
}
