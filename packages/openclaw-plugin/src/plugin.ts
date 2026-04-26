import type { CommandContext } from "./commands/spectyra-commands.js";
import { CompanionClient } from "./companion/companion-client.js";
import { createOpenClawAdapter } from "./openclaw/openclaw-adapter.js";

let optimizationEnabled = true;
let securityWarningsEnabled = true;

/**
 * OpenClaw plugin activation entry. Safe with `undefined` api (no host bindings).
 */
export function activateSpectyraPlugin(api: unknown) {
  const companion = new CompanionClient();
  const ctx: CommandContext = {
    companion,
    getOptimizationEnabled: () => optimizationEnabled,
    setOptimizationEnabled: (v: boolean) => {
      optimizationEnabled = v;
    },
    getSecurityWarningsEnabled: () => securityWarningsEnabled,
    setSecurityWarningsEnabled: (v: boolean) => {
      securityWarningsEnabled = v;
    },
  };
  return createOpenClawAdapter(api, ctx);
}

export default activateSpectyraPlugin;
