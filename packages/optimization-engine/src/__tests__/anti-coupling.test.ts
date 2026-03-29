/**
 * Anti-coupling + IP protection architectural tests.
 *
 * Rules enforced:
 *
 * 1. Core optimization engine must NOT import adapter modules.
 * 2. Core engine must NOT reference provider/tool names directly.
 * 3. Feature detectors must NOT use vendor names as primary logic path.
 * 4. Canonical model must NOT import higher-level packages.
 * 5. Browser/web code must NOT import server-only packages
 *    (optimizer-algorithms, optimization-engine). Use engine-client instead.
 * 6. engine-client must NOT import optimizer-algorithms or optimization-engine.
 *
 * SDK, Desktop, and Companion ARE allowed to import the full engine because
 * they run in Node.js (not browser). All optimization runs locally in-process.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VENDOR_TOOL_NAMES = [
  "openai",
  "anthropic",
  "groq",
  "openclaw",
  "cursor",
  "copilot",
  "claude",
  "gemini",
  "mistral",
  "llama",
  "gpt-4",
  "gpt-3",
];

const VENDOR_PATTERNS = VENDOR_TOOL_NAMES.map(name => ({
  name,
  regex: new RegExp(`(?:===|!==|==|!=)\\s*["'\`]${name}["'\`]`, "gi"),
}));

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === "__tests__") continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".spec.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function findViolations(files: string[]): Array<{ file: string; line: number; match: string; vendor: string }> {
  const violations: Array<{ file: string; line: number; match: string; vendor: string }> = [];
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
      for (const { name, regex } of VENDOR_PATTERNS) {
        regex.lastIndex = 0;
        if (regex.test(line)) {
          violations.push({ file, line: i + 1, match: line.trim(), vendor: name });
        }
      }
    }
  }
  return violations;
}

function findImportViolations(files: string[], forbiddenPackages: string[]): Array<{ file: string; line: number; match: string }> {
  const violations: Array<{ file: string; line: number; match: string }> = [];
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pkg of forbiddenPackages) {
        if (line.includes(`from "${pkg}`) || line.includes(`from '${pkg}`) || line.includes(`require("${pkg}`) || line.includes(`require('${pkg}`)) {
          violations.push({ file, line: i + 1, match: line.trim() });
        }
      }
    }
  }
  return violations;
}

// ── Test: optimization-engine must not reference vendor names ─────────────────

const engineSrcDir = join(__dirname, "..");
const engineFiles = collectTsFiles(engineSrcDir).filter(f => !f.includes("__tests__"));
const vendorViolations = findViolations(engineFiles);

if (vendorViolations.length > 0) {
  console.error("\n❌ ANTI-COUPLING VIOLATION: optimization-engine references vendor/tool names");
  for (const v of vendorViolations) {
    console.error(`  ${v.file}:${v.line} — vendor "${v.vendor}": ${v.match}`);
  }
  process.exit(1);
}

// ── Test: optimization-engine must not import adapter modules ─────────────────

const adapterImportViolations = findImportViolations(engineFiles, ["@spectyra/adapters"]);
if (adapterImportViolations.length > 0) {
  console.error("\n❌ ANTI-COUPLING VIOLATION: optimization-engine imports @spectyra/adapters");
  for (const v of adapterImportViolations) {
    console.error(`  ${v.file}:${v.line}: ${v.match}`);
  }
  process.exit(1);
}

// ── Test: feature-detection must not reference vendor names ───────────────────

const packagesDir = join(engineSrcDir, "../../..");
const featureDetSrcDir = join(packagesDir, "feature-detection", "src");
let featureDetFiles: string[] = [];
try {
  featureDetFiles = collectTsFiles(featureDetSrcDir).filter(f => !f.includes("__tests__"));
} catch { /* package may not be co-located in all setups */ }

if (featureDetFiles.length > 0) {
  const featureViolations = findViolations(featureDetFiles);
  if (featureViolations.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: feature-detection references vendor/tool names");
    for (const v of featureViolations) {
      console.error(`  ${v.file}:${v.line} — vendor "${v.vendor}": ${v.match}`);
    }
    process.exit(1);
  }

  const featureAdapterViolations = findImportViolations(featureDetFiles, ["@spectyra/adapters"]);
  if (featureAdapterViolations.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: feature-detection imports @spectyra/adapters");
    for (const v of featureAdapterViolations) {
      console.error(`  ${v.file}:${v.line}: ${v.match}`);
    }
    process.exit(1);
  }
}

// ── Test: canonical-model must not import adapters or engine ──────────────────

const canonicalSrcDir = join(packagesDir, "canonical-model", "src");
let canonicalFiles: string[] = [];
try {
  canonicalFiles = collectTsFiles(canonicalSrcDir).filter(f => !f.includes("__tests__"));
} catch { /* */ }

if (canonicalFiles.length > 0) {
  const canonicalViolations = findImportViolations(canonicalFiles, [
    "@spectyra/adapters",
    "@spectyra/optimization-engine",
    "@spectyra/feature-detection",
  ]);
  if (canonicalViolations.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: canonical-model imports higher-level packages");
    for (const v of canonicalViolations) {
      console.error(`  ${v.file}:${v.line}: ${v.match}`);
    }
    process.exit(1);
  }
}

// ── Test: engine-client must not import core IP ──────────────────────────────

const engineClientSrcDir = join(packagesDir, "engine-client", "src");
let engineClientFiles: string[] = [];
try { engineClientFiles = collectTsFiles(engineClientSrcDir).filter(f => !f.includes("__tests__")); } catch { /* */ }

if (engineClientFiles.length > 0) {
  const clientIPViolations = findImportViolations(engineClientFiles, [
    "@spectyra/optimizer-algorithms",
    "@spectyra/optimization-engine",
  ]);
  if (clientIPViolations.length > 0) {
    console.error("\n❌ IP PROTECTION VIOLATION: @spectyra/engine-client imports server-only packages");
    for (const v of clientIPViolations) {
      console.error(`  ${v.file}:${v.line}: ${v.match}`);
    }
    process.exit(1);
  }
}

// ── Test: web app (browser code) must not import core IP ─────────────────────

const webAppSrcDir = join(packagesDir, "..", "apps", "web", "src");
let webAppFiles: string[] = [];
try { webAppFiles = collectTsFiles(webAppSrcDir).filter(f => !f.includes("__tests__")); } catch { /* */ }

if (webAppFiles.length > 0) {
  const webIPViolations = findImportViolations(webAppFiles, [
    "@spectyra/optimizer-algorithms",
    "@spectyra/optimization-engine",
  ]);
  if (webIPViolations.length > 0) {
    console.error("\n❌ IP PROTECTION VIOLATION: web app (browser) imports server-only packages");
    console.error("  Web/browser code must use @spectyra/engine-client for lightweight transforms.");
    console.error("  Full optimization runs on the API server (Spectyra infrastructure).");
    for (const v of webIPViolations) {
      console.error(`  ${v.file}:${v.line}: ${v.match}`);
    }
    process.exit(1);
  }
}

// ── Test: analytics-core stays summary-first / provider-agnostic (Phase 1) ───

const analyticsSrcDir = join(packagesDir, "analytics-core", "src");
let analyticsFiles: string[] = [];
try {
  analyticsFiles = collectTsFiles(analyticsSrcDir).filter((f) => !f.includes("__tests__"));
} catch {
  /* */
}

if (analyticsFiles.length > 0) {
  const analyticsVendor = findViolations(analyticsFiles);
  if (analyticsVendor.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: analytics-core references vendor/tool names");
    for (const v of analyticsVendor) {
      console.error(`  ${v.file}:${v.line} — vendor "${v.vendor}": ${v.match}`);
    }
    process.exit(1);
  }
  const analyticsImports = findImportViolations(analyticsFiles, [
    "@spectyra/adapters",
    "@spectyra/event-adapters",
    "@spectyra/optimization-engine",
    "@spectyra/optimizer-algorithms",
  ]);
  if (analyticsImports.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: analytics-core imports forbidden higher-layer packages");
    for (const v of analyticsImports) {
      console.error(`  ${v.file}:${v.line}: ${v.match}`);
    }
    process.exit(1);
  }
}

// ── Test: event-core stays tool-agnostic — no adapter packages (Phase 2) ──────

const eventCoreSrcDir = join(packagesDir, "event-core", "src");
let eventCoreFiles: string[] = [];
try {
  eventCoreFiles = collectTsFiles(eventCoreSrcDir).filter((f) => !f.includes("__tests__"));
} catch {
  /* */
}

if (eventCoreFiles.length > 0) {
  const eventVendor = findViolations(eventCoreFiles);
  if (eventVendor.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: event-core references vendor/tool names");
    for (const v of eventVendor) {
      console.error(`  ${v.file}:${v.line} — vendor "${v.vendor}": ${v.match}`);
    }
    process.exit(1);
  }
  const eventImports = findImportViolations(eventCoreFiles, [
    "@spectyra/adapters",
    "@spectyra/event-adapters",
  ]);
  if (eventImports.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: event-core imports tool/provider adapter packages");
    for (const v of eventImports) {
      console.error(`  ${v.file}:${v.line}: ${v.match}`);
    }
    process.exit(1);
  }
}

// ── Test: execution-graph stays tool-agnostic (Phase 3) ───────────────────────

const execGraphSrcDir = join(packagesDir, "execution-graph", "src");
let execGraphFiles: string[] = [];
try {
  execGraphFiles = collectTsFiles(execGraphSrcDir).filter((f) => !f.includes("__tests__"));
} catch {
  /* package optional in shallow checkouts */
}

if (execGraphFiles.length > 0) {
  const egVendor = findViolations(execGraphFiles);
  if (egVendor.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: execution-graph references vendor/tool names");
    for (const v of egVendor) {
      console.error(`  ${v.file}:${v.line} — vendor "${v.vendor}": ${v.match}`);
    }
    process.exit(1);
  }
  const egImports = findImportViolations(execGraphFiles, [
    "@spectyra/adapters",
    "@spectyra/event-adapters",
    "@spectyra/optimization-engine",
    "@spectyra/optimizer-algorithms",
  ]);
  if (egImports.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: execution-graph imports forbidden packages");
    for (const v of egImports) {
      console.error(`  ${v.file}:${v.line}: ${v.match}`);
    }
    process.exit(1);
  }
}

// ── Test: state-delta stays tool-agnostic (Phase 4) ───────────────────────────

const stateDeltaSrcDir = join(packagesDir, "state-delta", "src");
let stateDeltaFiles: string[] = [];
try {
  stateDeltaFiles = collectTsFiles(stateDeltaSrcDir).filter((f) => !f.includes("__tests__"));
} catch {
  /* */
}

if (stateDeltaFiles.length > 0) {
  const sdVendor = findViolations(stateDeltaFiles);
  if (sdVendor.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: state-delta references vendor/tool names");
    for (const v of sdVendor) {
      console.error(`  ${v.file}:${v.line} — vendor "${v.vendor}": ${v.match}`);
    }
    process.exit(1);
  }
  const sdImports = findImportViolations(stateDeltaFiles, [
    "@spectyra/adapters",
    "@spectyra/event-adapters",
    "@spectyra/optimization-engine",
    "@spectyra/optimizer-algorithms",
  ]);
  if (sdImports.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: state-delta imports forbidden packages");
    for (const v of sdImports) {
      console.error(`  ${v.file}:${v.line}: ${v.match}`);
    }
    process.exit(1);
  }
}

// ── Test: learning stays tool-agnostic (Phase 5) ───────────────────────────────

const learningSrcDir = join(packagesDir, "learning", "src");
let learningFiles: string[] = [];
try {
  learningFiles = collectTsFiles(learningSrcDir).filter((f) => !f.includes("__tests__"));
} catch {
  /* */
}

if (learningFiles.length > 0) {
  const lrVendor = findViolations(learningFiles);
  if (lrVendor.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: learning references vendor/tool names");
    for (const v of lrVendor) {
      console.error(`  ${v.file}:${v.line} — vendor "${v.vendor}": ${v.match}`);
    }
    process.exit(1);
  }
  const lrImports = findImportViolations(learningFiles, [
    "@spectyra/adapters",
    "@spectyra/event-adapters",
    "@spectyra/optimization-engine",
    "@spectyra/optimizer-algorithms",
  ]);
  if (lrImports.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: learning imports forbidden packages");
    for (const v of lrImports) {
      console.error(`  ${v.file}:${v.line}: ${v.match}`);
    }
    process.exit(1);
  }
}

// ── Test: workflow-policy stays tool-agnostic (Phase 6) ───────────────────────

const workflowPolicySrcDir = join(packagesDir, "workflow-policy", "src");
let workflowPolicyFiles: string[] = [];
try {
  workflowPolicyFiles = collectTsFiles(workflowPolicySrcDir).filter((f) => !f.includes("__tests__"));
} catch {
  /* */
}

if (workflowPolicyFiles.length > 0) {
  const wpVendor = findViolations(workflowPolicyFiles);
  if (wpVendor.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: workflow-policy references vendor/tool names");
    for (const v of wpVendor) {
      console.error(`  ${v.file}:${v.line} — vendor "${v.vendor}": ${v.match}`);
    }
    process.exit(1);
  }
  const wpImports = findImportViolations(workflowPolicyFiles, [
    "@spectyra/adapters",
    "@spectyra/event-adapters",
    "@spectyra/optimization-engine",
    "@spectyra/optimizer-algorithms",
  ]);
  if (wpImports.length > 0) {
    console.error("\n❌ ANTI-COUPLING VIOLATION: workflow-policy imports forbidden packages");
    for (const v of wpImports) {
      console.error(`  ${v.file}:${v.line}: ${v.match}`);
    }
    process.exit(1);
  }
}

console.log("✅ All anti-coupling + IP protection checks passed.");
