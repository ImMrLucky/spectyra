#!/usr/bin/env node
/**
 * Ensures analytics-core and event-core never import @spectyra/event-adapters
 * (tool-specific logic stays in adapters only). Recurses into subdirectories.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const forbiddenImport = /^import\s+[^;]*from\s+["']@spectyra\/event-adapters["']/m;

function collectTsFiles(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === "dist" || name.name === "__tests__") continue;
      files.push(...collectTsFiles(full));
    } else if (name.name.endsWith(".ts") && !name.name.endsWith(".test.ts") && !name.name.endsWith(".spec.ts")) {
      files.push(full);
    }
  }
  return files;
}

const packages = [
  "packages/analytics-core/src",
  "packages/event-core/src",
  "packages/execution-graph/src",
  "packages/state-delta/src",
  "packages/learning/src",
  "packages/workflow-policy/src",
];

let failed = false;
for (const rel of packages) {
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir)) continue;
  for (const file of collectTsFiles(dir)) {
    const text = fs.readFileSync(file, "utf8");
    if (forbiddenImport.test(text)) {
      console.error(`Forbidden import in ${path.relative(root, file)}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("check-event-coupling: ok");
