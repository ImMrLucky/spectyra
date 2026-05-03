#!/usr/bin/env node
import { runScan } from "./scanner/index.js";
import { verifyIntegration } from "./scanner/verifyEngine.js";
import { normalizeProjectRoot } from "./utils/paths.js";
import { log } from "./utils/logger.js";
import { openBrowser } from "./utils/openBrowser.js";
import { startDoctorServer } from "./server.js";
import { setLastResult } from "./state.js";

type Parsed = {
  cmd: "default" | "scan" | "verify" | "ui";
  path: string;
  port: number;
  noOpen: boolean;
  noUi: boolean;
  json: boolean;
  maxFileSizeMb: number;
  /** Exact byte cap when set via --max-file-size (overrides --max-file-size-mb). */
  maxFileSizeBytes?: number;
  /** Dev bridge base URL (with or without `/__spectyra`) for `verify`. */
  runtimeUrl?: string;
};

function parseArgv(argv: string[]): Parsed {
  const out: Parsed = {
    cmd: "default",
    path: process.cwd(),
    port: 4120,
    noOpen: false,
    noUi: false,
    json: false,
    maxFileSizeMb: 1,
  };
  const args = [...argv];
  if (args[0] === "scan") {
    out.cmd = "scan";
    args.shift();
  } else if (args[0] === "verify") {
    out.cmd = "verify";
    args.shift();
  } else if (args[0] === "ui") {
    out.cmd = "ui";
    args.shift();
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--path" && args[i + 1]) {
      out.path = args[++i]!;
      continue;
    }
    if (a === "--port" && args[i + 1]) {
      out.port = parseInt(args[++i]!, 10) || 4120;
      continue;
    }
    if (a === "--no-open") {
      out.noOpen = true;
      continue;
    }
    if (a === "--no-ui") {
      out.noUi = true;
      continue;
    }
    if (a === "--json") {
      out.json = true;
      continue;
    }
    if (a === "--max-file-size-mb" && args[i + 1]) {
      out.maxFileSizeMb = Math.max(0.1, parseFloat(args[++i]!) || 1);
      continue;
    }
    if (a === "--max-file-size" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n > 0) out.maxFileSizeBytes = n;
      continue;
    }
    if (a === "--runtime-url" && args[i + 1]) {
      out.runtimeUrl = args[++i]!;
      continue;
    }
    if (a === "--watch" || a === "--verbose") {
      continue;
    }
    if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`spectyra-doctor — Spectyra AI Integration Scanner

Usage:
  spectyra-doctor [options]
  spectyra-doctor scan [options]
  spectyra-doctor verify [options]
  spectyra-doctor ui [options]

Options:
  --path <dir>           Project root (default: cwd)
  --port <n>             UI port (default: 4120)
  --no-open              Do not open a browser
  --no-ui                Terminal scan only (no local server)
  --json                 JSON output (scan / verify)
  --max-file-size-mb <n> Skip files larger than this (default: 1)
  --max-file-size <bytes> Skip files larger than this exact size in bytes (overrides --max-file-size-mb)
  --runtime-url <url>    With verify: probe live Spectyra dev bridge (append /__spectyra if omitted)
  -h, --help             Show help
`);
}

function maxBytesForScan(opts: Parsed): number {
  if (opts.maxFileSizeBytes !== undefined && opts.maxFileSizeBytes > 0) return opts.maxFileSizeBytes;
  return Math.round(opts.maxFileSizeMb * 1_000_000);
}

async function startUiFlow(opts: Parsed): Promise<void> {
  const projectRoot = normalizeProjectRoot(opts.path);
  const maxFileSizeBytes = maxBytesForScan(opts);
  if (opts.noUi) {
    const result = await runScan(projectRoot, { maxFileSizeBytes });
    setLastResult(result);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else printScanReport(result);
    return;
  }

  const { url, close } = await startDoctorServer({ projectRoot, port: opts.port });
  log.ok(`Spectyra Doctor listening at ${url}`);
  if (!opts.noOpen) {
    try {
      await openBrowser(url);
    } catch {
      log.warn("Could not open browser automatically");
    }
  }
  try {
    await fetch(
      `${url}/api/scan?maxFileSizeMb=${encodeURIComponent(String(opts.maxFileSizeMb))}` +
        (opts.maxFileSizeBytes ? `&maxFileSizeBytes=${encodeURIComponent(String(opts.maxFileSizeBytes))}` : ""),
    );
  } catch {
    log.warn("Initial scan request failed — use Rescan in UI");
  }

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await close();
    } finally {
      process.exit(0);
    }
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

async function main(): Promise<void> {
  const opts = parseArgv(process.argv.slice(2));
  const projectRoot = normalizeProjectRoot(opts.path);
  const scanOpts = { maxFileSizeBytes: maxBytesForScan(opts) };

  if (opts.cmd === "scan") {
    const result = await runScan(projectRoot, scanOpts);
    setLastResult(result);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else printScanReport(result);
    return;
  }

  if (opts.cmd === "verify") {
    const result = await runScan(projectRoot, scanOpts);
    setLastResult(result);
    const { lines, runtime } = await verifyIntegration(result, { runtimeUrl: opts.runtimeUrl });
    if (opts.json) console.log(JSON.stringify({ result, lines, runtime }, null, 2));
    else {
      log.info("Spectyra Doctor — verify");
      console.log(`Project: ${projectRoot}\n`);
      for (const line of lines) {
        console.log(`${line.ok ? "✅" : "❌"} ${line.label}${line.detail ? ` — ${line.detail}` : ""}`);
      }
      if (runtime?.possiblyMissed?.length) {
        console.log("\nProviders seen in scan but not in recent runtime events:");
        for (const m of runtime.possiblyMissed) {
          console.log(`  • ${m.provider}: ${m.files.join(", ")}`);
        }
      }
    }
    return;
  }

  if (opts.cmd === "ui") {
    await startUiFlow(opts);
    return;
  }

  await startUiFlow(opts);
}

function printScanReport(result: Awaited<ReturnType<typeof runScan>>): void {
  log.info("Spectyra Doctor");
  console.log(`Project: ${result.projectRoot}`);
  console.log(`Scanned at: ${result.scannedAt}`);
  console.log(`Files: ${result.summary.filesScanned} scanned | skipped rows: ${result.summary.filesSkipped ?? 0} | dirs not descended: ${result.summary.directoriesSkipped ?? 0}`);
  if (result.fileWalk) {
    const br = result.fileWalk.skippedByReason["binary-file"] ?? 0;
    const sy = result.fileWalk.skippedByReason.symlink ?? 0;
    const sec = result.fileWalk.skippedByReason["secret-file"] ?? 0;
    console.log(`  (binaries skipped: ${br}, symlinks skipped: ${sy}, secret paths skipped: ${sec})`);
  }
  console.log(`AI findings: ${result.summary.aiFindings}\n`);
  console.log("Providers (aggregated):");
  for (const [k, v] of Object.entries(result.summary.providers)) {
    console.log(`  ${k}: ${v}`);
  }
  if (Object.keys(result.summary.providers).length === 0) console.log("  (none)");
  console.log("\nTop AI findings:");
  for (const f of result.aiFindings.slice(0, 20)) {
    console.log(`  - ${f.relativePath}:${f.line} [${f.provider}] ${f.usageType} (${Math.round(f.confidence * 100)}%)`);
  }
  if (result.aiFindings.length === 0) console.log("  (none)");
  console.log("\nRecommended next steps:");
  for (const r of result.recommendations.slice(0, 8)) {
    console.log(`  • [${r.priority}] ${r.title}`);
    if (r.suggestedCode) console.log(`    ${r.suggestedCode.split("\n")[0]}`);
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
