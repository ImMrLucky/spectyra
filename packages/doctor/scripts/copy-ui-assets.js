#!/usr/bin/env node
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcUi = join(root, "src", "ui");
const distUi = join(root, "dist", "ui");
if (!existsSync(srcUi)) {
  console.warn("[doctor] No src/ui to copy");
  process.exit(0);
}
mkdirSync(distUi, { recursive: true });
cpSync(srcUi, distUi, { recursive: true });
console.log("[doctor] UI assets copied to dist/ui");
