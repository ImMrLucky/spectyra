import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { scanAiUsage } from "../scanner/aiUsageScanner.js";
import type { DoctorScanReport, PackageFinding, ScannableFile } from "../scanner/types.js";
import { buildIntegrationPlan } from "./integrationPlan.js";

function makePackage(root: string, hasSpectyraSdk = false, hasSpectyraAutoImport = false): PackageFinding {
  return {
    packageDir: ".",
    relativePath: ".",
    manifestPath: join(root, "package.json"),
    packageManager: "npm",
    hasSpectyraSdk,
    hasSpectyraAutoImport,
    hasLegacySpectyraAuto: false,
    hasLegacySpectyraDevtools: false,
    aiDependencyHints: [],
    aiFindingCount: 1,
    installCommand: "npm install @spectyra/sdk",
  };
}

function makeReport(root: string, files: ScannableFile[], hasSpectyraSdk = false, hasSpectyraAutoImport = false): DoctorScanReport {
  const aiFindings = scanAiUsage(root, files, { primaryEntry: "src/main.ts", manifestAbsPaths: [join(root, "package.json")] });
  return {
    projectRoot: root,
    scannedAt: new Date().toISOString(),
    packageManager: "npm",
    projectType: "node",
    summary: {
      filesScanned: files.length,
      aiFindings: aiFindings.length,
      highConfidenceFindings: aiFindings.filter((f) => f.confidence >= 0.8).length,
      providers: {},
      usageTypes: {},
      modelsDetected: [],
      packagesWithAiUsage: ["."],
      spectyraInstalled: hasSpectyraSdk,
      spectyraAutoDetected: hasSpectyraAutoImport,
      recommendedNextStep: "",
    },
    packages: [makePackage(root, hasSpectyraSdk, hasSpectyraAutoImport)],
    actionableFilePaths: files.map((f) => f.relativePath),
    aiFindings,
    integrationPoints: [{ filePath: join(root, "src/main.ts"), relativePath: "src/main.ts", type: "server-entrypoint", confidence: 0.8, reason: "test", suggestedAction: "Add auto import" }],
    recommendations: [],
    integrationPlan: {
      status: "not-started",
      headline: "",
      summary: "",
      score: 0,
      blockers: [],
      completed: [],
      tracks: [],
      steps: [],
      monitorNextSteps: [],
    },
    risks: [],
    frameworks: [],
    providers: [],
    entrypoints: [],
    spectyraStatus: {
      sdkInstalled: hasSpectyraSdk,
      sdkVersion: undefined,
      sdkPackageManagers: [],
      sdkAutoImportFiles: hasSpectyraAutoImport ? ["src/main.ts"] : [],
      legacyAutoImportFiles: [],
      legacyDevtoolsImportFiles: [],
      packageFindings: [],
      issues: [],
    },
    warnings: [],
    aiCallSites: [],
  };
}

function writeFixture(relativePath: string, content: string) {
  const root = join(tmpdir(), `spectyra-plan-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const full = join(root, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t" }), "utf8");
  writeFileSync(full, content, "utf8");
  return {
    root,
    file: { path: full, relativePath, extension: ".ts", language: "typescript", sizeBytes: content.length, reason: "test" } satisfies ScannableFile,
  };
}

describe("CLI harness integration plan", () => {
  it("generates file-specific Claude CLI instructions without Anthropic SDK wrapper code", () => {
    const { root, file } = writeFixture(
      "src/agents/runner.ts",
      `import { execa } from "execa";
export async function runAgent(prompt: string) {
  return execa("claude", ["-p", prompt]);
}`,
    );
    try {
      const report = makeReport(root, [file]);
      const plan = buildIntegrationPlan(report);
      const cliTrack = plan.tracks.find((t) => t.kind === "ai-cli-harness");
      const allCode = plan.steps.flatMap((s) => s.codeBlocks).map((b) => b.code).join("\n");

      expect(report.aiFindings.some((f) => f.callStyle === "cli" && f.cliTool === "claude" && f.framework === "claude-cli-harness")).toBe(true);
      expect(cliTrack?.title).toBe("Claude CLI harness integration");
      expect(cliTrack?.steps.some((s) => s.kind === "install-sdk")).toBe(true);
      expect(cliTrack?.steps.some((s) => s.kind === "add-auto-import")).toBe(true);
      expect(allCode).toContain('import { createClaudeCliHarness } from "@spectyra/sdk/cli"');
      expect(allCode).toContain("runClaudeWithSpectyra(prompt)");
      expect(allCode).not.toContain("@anthropic-ai/sdk");
      expect(allCode).not.toContain("createAnthropicAdapter");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("generates streaming-safe Claude CLI instructions", () => {
    const { root, file } = writeFixture(
      "src/agents/stream.ts",
      `import { spawn } from "node:child_process";
export function run(prompt: string) {
  return spawn("claude", ["--output-format", "stream-json", "-p", prompt]);
}`,
    );
    try {
      const report = makeReport(root, [file]);
      const plan = buildIntegrationPlan(report);
      const allCode = plan.steps.flatMap((s) => s.codeBlocks).map((b) => b.code).join("\n");
      expect(report.aiFindings.some((f) => f.isStreaming)).toBe(true);
      expect(allCode).toContain("preserveStreaming: true");
      expect(allCode).toContain("onStdout(chunk)");
      expect(allCode).toContain("onChunk?.(chunk)");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("generates Gemini and Codex CLI wrappers", () => {
    const gemini = writeFixture("src/gemini.ts", `import { execa } from "execa";\nexeca("gemini", ["-p", prompt]);`);
    const codex = writeFixture("src/codex.ts", `import { execa } from "execa";\nexeca("codex", ["exec", prompt]);`);
    try {
      const geminiPlan = buildIntegrationPlan(makeReport(gemini.root, [gemini.file]));
      const codexPlan = buildIntegrationPlan(makeReport(codex.root, [codex.file]));
      const geminiCode = geminiPlan.steps.flatMap((s) => s.codeBlocks).map((b) => b.code).join("\n");
      const codexCode = codexPlan.steps.flatMap((s) => s.codeBlocks).map((b) => b.code).join("\n");
      expect(geminiCode).toContain("createGeminiCliHarness");
      expect(geminiCode).toContain("runGeminiWithSpectyra");
      expect(codexCode).toContain("createCodexCliHarness");
      expect(codexCode).toContain("runCodexWithSpectyra");
    } finally {
      rmSync(gemini.root, { recursive: true, force: true });
      rmSync(codex.root, { recursive: true, force: true });
    }
  });

  it("keeps provider SDK and AI CLI harness tracks separate in mixed apps", () => {
    const { root, file } = writeFixture(
      "src/both.ts",
      `import OpenAI from "openai";
import { execa } from "execa";
const openai = new OpenAI();
await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [] });
await execa("claude", ["-p", prompt]);`,
    );
    try {
      const plan = buildIntegrationPlan(makeReport(root, [file]));
      const allCode = plan.steps.flatMap((s) => s.codeBlocks).map((b) => b.code).join("\n");
      expect(plan.tracks.some((t) => t.kind === "provider-sdk")).toBe(true);
      expect(plan.tracks.some((t) => t.kind === "ai-cli-harness")).toBe(true);
      expect(allCode).toContain("createOpenAIAdapter");
      expect(allCode).toContain("createClaudeCliHarness");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("marks CLI harness track ready when only wrapper evidence remains", () => {
    const { root, file } = writeFixture(
      "src/lib/ai/claudeCliHarness.ts",
      `import { createClaudeCliHarness } from "@spectyra/sdk/cli";
const claude = createClaudeCliHarness({ command: "claude" });
export async function runClaudeWithSpectyra(prompt: string) {
  return claude.run({ prompt });
}`,
    );
    try {
      const report = makeReport(root, [file], true, true);
      report.aiFindings = [
        {
          id: "wrapper",
          filePath: file.path,
          relativePath: file.relativePath,
          line: 2,
          language: "typescript",
          provider: "anthropic",
          providerEvidence: ["createClaudeCliHarness"],
          usageType: "agent",
          callStyle: "cli",
          methodName: "createClaudeCliHarness",
          framework: "claude-cli-harness",
          command: "claude",
          commandArgs: [],
          isCliHarness: true,
          cliTool: "claude",
          modelHints: [],
          envHints: [],
          urlHints: [],
          confidence: 0.94,
          severity: "high",
          snippet: "createClaudeCliHarness({ command: \"claude\" })",
          recommendation: {
            priority: "high",
            title: "test",
            summary: "test",
            notes: [],
            estimatedEffort: "15 minutes",
            confidence: 0.9,
          },
          packageDir: ".",
        },
      ];
      const plan = buildIntegrationPlan(report);
      expect(plan.readiness?.cliHarnessStatus).toBe("ready");
      expect(plan.tracks.find((t) => t.kind === "ai-cli-harness")?.status).toBe("ready");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
