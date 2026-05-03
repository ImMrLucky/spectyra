import type { DoctorScanResult } from "./types.js";
import { runRuntimeVerify, type RuntimeVerifyResult } from "./runtimeVerify.js";

export interface VerifyLine {
  ok: boolean;
  label: string;
  detail?: string;
}

export type VerifyIntegrationResult = { lines: VerifyLine[]; runtime?: RuntimeVerifyResult };

export async function verifyIntegration(
  result: DoctorScanResult,
  options?: { runtimeUrl?: string },
): Promise<VerifyIntegrationResult> {
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

  const runtimeUrl = options?.runtimeUrl?.trim();
  if (!runtimeUrl) {
    return { lines };
  }

  const runtime = await runRuntimeVerify(result.aiFindings, runtimeUrl);
  lines.push({
    ok: runtime.reachable,
    label: "Spectyra dev bridge reachable (runtime)",
    detail: runtime.reachable ? runtime.baseUrl : runtime.errors[0] ?? "No successful summary/events/waste response",
  });
  lines.push({
    ok: !runtime.reachable || runtime.summaryOk,
    label: "Bridge /summary",
    detail:
      runtime.summaryOk && runtime.requestCount !== undefined
        ? `requestCount≈${runtime.requestCount}`
        : runtime.summaryOk
          ? "OK"
          : runtime.errors.find((e) => e.includes("Summary")) ?? "unavailable",
  });
  lines.push({
    ok: !runtime.reachable || runtime.eventsOk,
    label: "Bridge /events",
    detail: runtime.eventsOk
      ? `${runtime.eventsObserved ?? 0} event(s); providers: ${runtime.providersObserved.length ? runtime.providersObserved.join(", ") : "—"}`
      : runtime.errors.find((e) => e.includes("Events")) ?? "unavailable",
  });
  lines.push({
    ok: !runtime.reachable || runtime.wasteOk,
    label: "Bridge /waste",
    detail: runtime.wasteOk ? "OK" : "endpoint missing or error",
  });

  for (const miss of runtime.possiblyMissed) {
    lines.push({
      ok: false,
      label: `Runtime did not observe provider: ${miss.provider}`,
      detail: `${miss.files.slice(0, 6).join(", ")}${miss.files.length > 6 ? "…" : ""} — ${miss.reason}`,
    });
  }

  return { lines, runtime };
}
