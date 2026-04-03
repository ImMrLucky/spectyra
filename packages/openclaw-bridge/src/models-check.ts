import type { CompanionModelsResponse, CompanionReachability } from "./types.js";

function stripV1(base: string): string {
  const u = base.trim().replace(/\/$/, "");
  return u.endsWith("/v1") ? u.slice(0, -3) : u;
}

/**
 * Probe Local Companion `GET /v1/models` (OpenAI-compatible). Never sends prompt content.
 */
export async function checkCompanionModels(
  openAiV1Base: string,
  init?: RequestInit,
): Promise<CompanionModelsResponse> {
  const root = stripV1(openAiV1Base).replace(/\/$/, "");
  const url = `${root}/v1/models`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      method: "GET",
      headers: { Accept: "application/json", ...(init?.headers as Record<string, string>) },
    });
  } catch {
    return {
      ok: false,
      reachability: "unreachable",
      modelIds: [],
      message: "Could not reach Local Companion models endpoint.",
    };
  }

  const reachability: CompanionReachability = "reachable";
  if (!res.ok) {
    return {
      ok: false,
      reachability,
      modelIds: [],
      message: `Models request failed (${res.status}).`,
    };
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return { ok: false, reachability, modelIds: [], message: "Invalid JSON from /v1/models." };
  }

  const data = raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)
    ? (raw as { data: Array<{ id?: string }> }).data
    : [];
  const modelIds = data.map((d) => d.id).filter((id): id is string => typeof id === "string");

  return {
    ok: true,
    reachability,
    modelIds,
    raw,
  };
}
