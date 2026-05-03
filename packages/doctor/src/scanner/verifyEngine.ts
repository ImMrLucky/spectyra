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
    ok: s.sdkInstalled,
    label: "@spectyra/sdk installed",
    detail: s.sdkInstalled ? undefined : "Add dependency in the package that runs LLM calls",
  });
  lines.push({
    ok: s.sdkAutoImportFiles.length > 0,
    label: "import '@spectyra/sdk/auto' found in scanned sources",
    detail: s.sdkAutoImportFiles[0],
  });
  lines.push({
    ok: s.legacyAutoImportFiles.length === 0,
    label: "No legacy @spectyra/auto imports (migrate if present)",
    detail:
      s.legacyAutoImportFiles.length > 0
        ? `Found in: ${s.legacyAutoImportFiles.slice(0, 3).join(", ")}`
        : undefined,
  });
  lines.push({
    ok: s.devtoolsImportFiles.length === 0,
    label: "No legacy @spectyra/devtools-only import required",
    detail:
      s.devtoolsImportFiles.length > 0
        ? `Optional cleanup: ${s.devtoolsImportFiles.slice(0, 2).join(", ")}`
        : undefined,
  });
  lines.push({
    ok: s.hasStartSpectyraAuto || s.sdkAutoImportFiles.length > 0 || s.legacyAutoImportFiles.length > 0,
    label: "startSpectyraAuto(...) or side-effect import",
  });
  lines.push({
    ok: !s.devtoolsImportFiles.length || s.hasDevBridge,
    label: "Dev bridge (for backend overlay / live monitoring)",
    detail:
      s.devtoolsImportFiles.length && !s.hasDevBridge
        ? "Add useSpectyraAutoDevBridge when the browser overlay should read API-side data"
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
