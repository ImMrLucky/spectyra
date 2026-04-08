#!/usr/bin/env node
/**
 * Removes Spectyra provider + spectyra/* default model from OpenClaw config
 * so you can re-run `spectyra-companion setup` end-to-end.
 *
 * Usage:
 *   node scripts/strip-openclaw-spectyra.mjs
 *   node scripts/strip-openclaw-spectyra.mjs ~/.openclaw/openclaw.json
 *
 * Writes a timestamped .bak next to the target file first.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const target =
  process.argv[2]?.trim() || join(homedir(), ".openclaw", "openclaw.json");

if (!existsSync(target)) {
  console.error(`Not found: ${target}`);
  process.exit(1);
}

const raw = readFileSync(target, "utf-8");
let j;
try {
  j = JSON.parse(raw);
} catch (e) {
  console.error(`Invalid JSON: ${target}`, e.message);
  process.exit(1);
}

const bak = `${target}.bak.${Date.now()}`;
copyFileSync(target, bak);
console.log(`Backup: ${bak}`);

if (j.models?.providers && typeof j.models.providers === "object" && "spectyra" in j.models.providers) {
  delete j.models.providers.spectyra;
  console.log("Removed models.providers.spectyra");
}

const primary = j.agents?.defaults?.model?.primary;
if (typeof primary === "string" && primary.startsWith("spectyra/")) {
  delete j.agents.defaults.model.primary;
  console.log(`Removed agents.defaults.model.primary (was ${primary})`);
}

// Optional: drop empty nested objects OpenClaw may not care about
if (j.agents?.defaults?.model && Object.keys(j.agents.defaults.model).length === 0) {
  delete j.agents.defaults.model;
}
if (j.agents?.defaults && Object.keys(j.agents.defaults).length === 0) {
  delete j.agents.defaults;
}
if (j.agents && Object.keys(j.agents).length === 0) {
  delete j.agents;
}

writeFileSync(target, JSON.stringify(j, null, 2) + "\n", "utf-8");
console.log(`Updated: ${target}`);
console.log("Next: run spectyra-companion setup (with openclaw on PATH).");
