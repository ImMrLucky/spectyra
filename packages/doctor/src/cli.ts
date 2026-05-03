#!/usr/bin/env node
import { runScan } from "./scanner/index.js";
import { verifyIntegration } from "./scanner/verifyEngine.js";
import { normalizeProjectRoot } from "./utils/paths.js";
import { log } from "./utils/logger.js";
import { openBrowser } from "./utils/openBrowser.js";
import { startDoctorServer } from "./server.js";
import { setLastResult } from "./state.js";

type Parsed = {
  cmd: "default" | "scan" | "verify";
  path: string;
  port: number;
  noOpen: boolean;
  noUi: boolean;
  json: boolean;
};

function parseArgv(argv: string[]): Parsed {
  const out: Parsed = {
    cmd: "default",
    path: process.cwd(),
    port: 4120,
    noOpen: false,
    noUi: false,
    json: false,
  };
  const args = [...argv];
  if (args[0] === "scan") {
    out.cmd = "scan";
    args.shift();
  } else if (args[0] === "verify") {
    out.cmd = "verify";
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
    if (a === "--watch") {
      /* v1: no-op */
      continue;
    }
    if (a === "--verbose") {
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
  console.log(`spectyra-doctor — Spectyra Integration Doctor

Usage:
  spectyra-doctor [options]
  spectyra-doctor scan [options]
  spectyra-doctor verify [options]

Options:
  --path <dir>    Project root (default: cwd)
  --port <n>      UI port (default: 4120)
  --no-open       Do not open a browser
  --no-ui         Terminal scan only (no local server)
  --json          JSON output (scan / verify)
  --watch         Reserved (ignored in v1)
  -h, --help      Show help
`);
}

async function main(): Promise<void> {
  const opts = parseArgv(process.argv.slice(2));
  const projectRoot = normalizeProjectRoot(opts.path);

  if (opts.cmd === "scan") {
    const result = await runScan(projectRoot, {});
    setLastResult(result);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else printScanReport(result);
    return;
  }

  if (opts.cmd === "verify") {
    const result = await runScan(projectRoot, {});
    setLastResult(result);
    const lines = verifyIntegration(result);
    if (opts.json) console.log(JSON.stringify({ result, lines }, null, 2));
    else {
      log.info("Spectyra Doctor — verify");
      console.log(`Project: ${projectRoot}\n`);
      for (const line of lines) {
        console.log(`${line.ok ? "✅" : "❌"} ${line.label}${line.detail ? ` — ${line.detail}` : ""}`);
      }
    }
    return;
  }

  if (opts.noUi) {
    const result = await runScan(projectRoot, {});
    setLastResult(result);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else printScanReport(result);
    return;
  }

  const { url, close } = await startDoctorServer({ projectRoot, port: opts.port });
  log.ok(`Spectyra Integration Doctor listening at ${url}`);
  if (!opts.noOpen) {
    try {
      await openBrowser(url);
    } catch {
      log.warn("Could not open browser automatically");
    }
  }
  try {
    await fetch(`${url}/api/scan`);
  } catch {
    log.warn("Initial scan request failed — use Rescan in UI");
  }

  const shutdown = async () => {
    await close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

function printScanReport(result: Awaited<ReturnType<typeof runScan>>): void {
  log.info("Spectyra Doctor");
  console.log(`Project: ${result.projectRoot}\n`);
  console.log("Providers:");
  for (const p of result.providers) {
    console.log(`  - ${p.provider} (${p.confidence})`);
  }
  if (result.providers.length === 0) console.log("  (none detected)");
  console.log("\nAI call sites:");
  for (const s of result.aiCallSites.slice(0, 40)) {
    console.log(`  - ${s.file}${s.line ? `:${s.line}` : ""} [${s.kind}]`);
  }
  if (result.aiCallSites.length === 0) console.log("  (none detected)");
  console.log("\nEntrypoints:");
  for (const e of result.entrypoints) {
    console.log(`  - ${e.file} (${e.type}, ${e.framework ?? "unknown"})`);
  }
  const top = result.recommendations[0];
  if (top) {
    console.log(`\nRecommended: ${top.title}`);
    console.log(top.summary);
    if (top.targetFile) console.log(`\nTarget file: ${top.targetFile}`);
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
