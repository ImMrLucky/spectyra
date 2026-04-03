import type { CompanionHealthResponse, CompanionReadiness, CompanionReachability } from "./types.js";

function companionOriginFromV1Base(baseUrl: string): string {
  const u = baseUrl.trim().replace(/\/$/, "");
  if (u.endsWith("/v1")) return u.slice(0, -3);
  return u;
}

/**
 * Probe Local Companion `GET /health`. Never sends prompt content.
 */
export async function checkCompanionHealth(
  companionOrigin: string,
  init?: RequestInit,
): Promise<CompanionHealthResponse> {
  const origin = companionOrigin.replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${origin}/health`, {
      ...init,
      method: "GET",
      headers: { Accept: "application/json", ...(init?.headers as Record<string, string>) },
    });
  } catch {
    return {
      reachability: "unreachable",
      readiness: "unknown",
      message: "Could not reach Spectyra Local Companion (is the desktop app running?)",
    };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const reachability: CompanionReachability = "reachable";
  const status = typeof body["status"] === "string" ? body["status"] : undefined;
  const providerConfigured =
    typeof body["providerConfigured"] === "boolean" ? body["providerConfigured"] : undefined;
  const companionReady = typeof body["companionReady"] === "boolean" ? body["companionReady"] : undefined;
  const runMode = typeof body["runMode"] === "string" ? body["runMode"] : undefined;
  const provider = typeof body["provider"] === "string" ? body["provider"] : undefined;
  const licenseKeyPresent =
    typeof body["licenseKeyPresent"] === "boolean" ? body["licenseKeyPresent"] : undefined;
  const licenseAllowsFullOptimization =
    typeof body["licenseAllowsFullOptimization"] === "boolean"
      ? body["licenseAllowsFullOptimization"]
      : undefined;
  const telemetryMode = typeof body["telemetryMode"] === "string" ? body["telemetryMode"] : undefined;

  let readiness: CompanionReadiness = "unknown";
  if (!res.ok || status !== "ok") {
    readiness = "not_ready";
  } else if (companionReady === true) {
    readiness = "ready";
  } else if (companionReady === false || providerConfigured === false) {
    readiness = "not_ready";
  } else {
    readiness = "ready";
  }

  return {
    reachability,
    readiness,
    status,
    runMode,
    provider,
    providerConfigured,
    companionReady,
    licenseKeyPresent,
    licenseAllowsFullOptimization,
    telemetryMode,
    message:
      readiness === "ready"
        ? "Local Companion is running and ready for inference."
        : "Local Companion responded but is not fully ready (check provider key in Desktop settings).",
  };
}

/** Resolve health URL when callers only know the `/v1` base (e.g. from wizard defaults). */
export function healthUrlFromOpenAiBase(openAiV1Base: string): string {
  const origin = companionOriginFromV1Base(openAiV1Base);
  return `${origin}/health`;
}
