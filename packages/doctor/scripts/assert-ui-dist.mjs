#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distUi = join(__dirname, "..", "dist", "ui");
const required = ["index.html", "app.js", "styles.css"];
for (const f of required) {
  const p = join(distUi, f);
  if (!existsSync(p)) {
    console.error(`[doctor] Missing UI asset: dist/ui/${f}`);
    process.exit(1);
  }
}
console.log("[doctor] dist/ui assets OK:", required.join(", "));
