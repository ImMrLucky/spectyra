#!/usr/bin/env node
/**
 * Ensures analytics-core and event-core never import @spectyra/event-adapters
 * (tool-specific logic stays in adapters only).
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const forbiddenImport = /^import\s+[^;]*from\s+["']@spectyra\/event-adapters["']/m;
const packages = ["packages/analytics-core/src", "packages/event-core/src"];

let failed = false;
for (const rel of packages) {
  const dir = path.join(root, rel);
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".ts")) continue;
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    if (forbiddenImport.test(text)) {
      console.error(`Forbidden import in ${rel}/${name}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("check-event-coupling: ok");
