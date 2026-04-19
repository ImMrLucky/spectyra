import { execFileSync } from "node:child_process";
import { spectyraOpenClawModelDefinitions } from "@spectyra/shared";

export type ApplyOpenClawConfigResult = {
  ok: boolean;
  openclawOnPath: boolean;
  providerSet: boolean;
  defaultModelSet: boolean;
};

/**
 * Point OpenClaw at the local Spectyra companion (127.0.0.1) and prefer spectyra/smart.
 * Best-effort: skips quietly when `openclaw` is not installed.
 */
export function applyOpenClawSpectyraProvider(port: number): ApplyOpenClawConfigResult {
  const out: ApplyOpenClawConfigResult = {
    ok: false,
    openclawOnPath: false,
    providerSet: false,
    defaultModelSet: false,
  };
  try {
    execFileSync("which", ["openclaw"], { stdio: "ignore" });
    out.openclawOnPath = true;
  } catch {
    return out;
  }

  const baseUrl = `http://127.0.0.1:${port}/v1`;
  const providerJson = JSON.stringify({
    baseUrl,
    api: "openai-completions",
    models: spectyraOpenClawModelDefinitions(),
  });

  try {
    execFileSync("openclaw", ["config", "set", "models.providers.spectyra", providerJson, "--strict-json"], {
      stdio: "pipe",
    });
    out.providerSet = true;
  } catch {
    /* OpenClaw schema may differ */
  }

  try {
    execFileSync(
      "openclaw",
      ["config", "set", "agents.defaults.model.primary", '"spectyra/smart"', "--strict-json"],
      { stdio: "pipe" },
    );
    out.defaultModelSet = true;
  } catch {
    /* */
  }

  out.ok = out.providerSet || out.defaultModelSet;
  return out;
}
