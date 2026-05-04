import type { AiUsageFinding, DoctorCodeBlock, IntegrationPoint } from "../scanner/types.js";

export function suggestedCliWrapperFile(finding: AiUsageFinding, integrationPoints: IntegrationPoint[] = []): string {
  const existing = integrationPoints.find((p) => {
    if (p.type !== "llm-wrapper" && p.type !== "provider-client") return false;
    if (!/claude|gemini|codex|aider|opencode|agent|harness|runner/i.test(p.relativePath)) return false;
    if (!finding.packageDir || finding.packageDir === ".") return true;
    return p.relativePath.startsWith(`${finding.packageDir}/`);
  });
  if (existing) return existing.relativePath;

  const prefix = finding.packageDir && finding.packageDir !== "." ? `${finding.packageDir}/` : "";
  if (finding.cliTool === "claude") return `${prefix}src/lib/ai/claudeCliHarness.ts`;
  if (finding.cliTool === "gemini") return `${prefix}src/lib/ai/geminiCliHarness.ts`;
  if (finding.cliTool === "codex") return `${prefix}src/lib/ai/codexCliHarness.ts`;
  if (finding.cliTool === "aider") return `${prefix}src/lib/ai/aiderCliHarness.ts`;
  if (finding.cliTool === "opencode") return `${prefix}src/lib/ai/opencodeCliHarness.ts`;
  return `${prefix}src/lib/ai/aiCliHarness.ts`;
}

export function cliToolTitle(finding: AiUsageFinding): string {
  if (finding.cliTool === "claude") return "Claude CLI";
  if (finding.cliTool === "gemini") return "Gemini CLI";
  if (finding.cliTool === "codex") return "Codex CLI";
  if (finding.cliTool === "aider") return "Aider CLI";
  if (finding.cliTool === "opencode") return "OpenCode CLI";
  return "Custom AI CLI";
}

export function cliRunnerName(finding: AiUsageFinding): string {
  if (finding.cliTool === "claude") return "runClaudeWithSpectyra";
  if (finding.cliTool === "gemini") return "runGeminiWithSpectyra";
  if (finding.cliTool === "codex") return "runCodexWithSpectyra";
  if (finding.cliTool === "aider") return "runAiderWithSpectyra";
  if (finding.cliTool === "opencode") return "runOpenCodeWithSpectyra";
  return "runAiCliWithSpectyra";
}

export function cliFactoryName(finding: AiUsageFinding): string {
  if (finding.cliTool === "claude") return "createClaudeCliHarness";
  if (finding.cliTool === "gemini") return "createGeminiCliHarness";
  if (finding.cliTool === "codex") return "createCodexCliHarness";
  return "createCliHarness";
}

export function cliCommand(finding: AiUsageFinding): string {
  if (finding.command) return finding.command;
  if (finding.cliTool === "claude") return "claude";
  if (finding.cliTool === "gemini") return "gemini";
  if (finding.cliTool === "codex") return "codex";
  if (finding.cliTool === "aider") return "aider";
  if (finding.cliTool === "opencode") return "opencode";
  return "your-ai-command";
}

export function buildCliHarnessIntegrationBlocks(
  finding: AiUsageFinding,
  integrationPoints: IntegrationPoint[] = [],
): DoctorCodeBlock[] {
  const wrapperFile = suggestedCliWrapperFile(finding, integrationPoints);
  const blocks: DoctorCodeBlock[] = [
    {
      title: `${wrapperFile.includes("src/lib/ai") ? "Create" : "Update existing harness file"} ${wrapperFile}`,
      language: "ts",
      copyLabel: "Copy CLI harness wrapper",
      code: wrapperCode(finding),
    },
    {
      title: `Replace raw CLI call in ${finding.relativePath}:${finding.line}`,
      language: languageForFinding(finding),
      copyLabel: "Copy call-site replacement",
      code: replacementCode(finding, wrapperFile),
    },
  ];

  if (finding.isStreaming) {
    blocks.push({
      title: "Streaming call-site replacement",
      language: languageForFinding(finding),
      copyLabel: "Copy streaming replacement",
      code: streamingReplacementCode(finding, wrapperFile),
    });
  }

  blocks.push({
    title: "Run and rescan",
    language: "bash",
    copyLabel: "Copy run and rescan commands",
    code: `${finding.packageDir && finding.packageDir !== "." ? `cd ${finding.packageDir}\n` : ""}npm run dev
spectyra-doctor scan
spectyra-doctor verify`,
  });

  return blocks;
}

export function replacementCode(finding: AiUsageFinding, wrapperFile = suggestedCliWrapperFile(finding)): string {
  const runner = cliRunnerName(finding);
  const importPath = importPathForWrapper(wrapperFile);
  const tool = cliToolTitle(finding).replace(" CLI", "");
  if (finding.isStreaming) return streamingReplacementCode(finding, wrapperFile);
  return `// Replace the raw ${tool} CLI call at ${finding.relativePath}:${finding.line}
import { ${runner} } from "${importPath}";

// Pass the same prompt value you currently send to \`${cliCommand(finding)} -p\` or \`${cliCommand(finding)} --print\`.
const result = await ${runner}(prompt);
`;
}

function streamingReplacementCode(finding: AiUsageFinding, wrapperFile: string): string {
  const runner = cliRunnerName(finding);
  return `// Replace the raw streaming ${cliToolTitle(finding)} call at ${finding.relativePath}:${finding.line}
import { ${runner} } from "${importPathForWrapper(wrapperFile)}";

const result = await ${runner}(prompt, (chunk) => {
  process.stdout.write(chunk);
});
`;
}

function wrapperCode(finding: AiUsageFinding): string {
  if (finding.cliTool === "claude" || finding.framework === "claude-cli-harness") return claudeWrapperCode(finding.isStreaming === true);
  if (finding.cliTool === "gemini" || finding.framework === "gemini-cli-harness") return geminiWrapperCode();
  if (finding.cliTool === "codex" || finding.framework === "codex-cli-harness") return codexWrapperCode();
  return genericWrapperCode(finding);
}

function claudeWrapperCode(streaming: boolean): string {
  if (streaming) {
    return `import { createClaudeCliHarness } from "@spectyra/sdk/cli";

const claude = createClaudeCliHarness({
  command: "claude",
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
  defaultArgs: ["--output-format", "stream-json"],
  preserveStreaming: true,
});

export async function runClaudeWithSpectyra(
  prompt: string,
  onChunk?: (chunk: Buffer | string) => void,
) {
  return claude.run({
    prompt,
    args: ["--output-format", "stream-json"],
    onStdout(chunk) {
      onChunk?.(chunk);
    },
    metadata: {
      provider: "anthropic",
      framework: "claude-cli-harness",
      taskType: "coding-agent",
      streaming: true,
    },
  });
}
`;
  }

  return `import { createClaudeCliHarness } from "@spectyra/sdk/cli";

const claude = createClaudeCliHarness({
  command: "claude",
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
  defaultArgs: ["--output-format", "json"],
});

export async function runClaudeWithSpectyra(prompt: string) {
  return claude.run({
    prompt,
    metadata: {
      provider: "anthropic",
      framework: "claude-cli-harness",
      taskType: "coding-agent",
    },
  });
}
`;
}

function geminiWrapperCode(): string {
  return `import { createGeminiCliHarness } from "@spectyra/sdk/cli";

const gemini = createGeminiCliHarness({
  command: "gemini",
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

export async function runGeminiWithSpectyra(prompt: string) {
  return gemini.run({
    prompt,
    metadata: {
      provider: "gemini",
      framework: "gemini-cli-harness",
      taskType: "coding-agent",
    },
  });
}
`;
}

function codexWrapperCode(): string {
  return `import { createCodexCliHarness } from "@spectyra/sdk/cli";

const codex = createCodexCliHarness({
  command: "codex",
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

export async function runCodexWithSpectyra(prompt: string) {
  return codex.run({
    prompt,
    metadata: {
      provider: "openai",
      framework: "codex-cli-harness",
      taskType: "coding-agent",
    },
  });
}
`;
}

function genericWrapperCode(finding: AiUsageFinding): string {
  const command = cliCommand(finding);
  const framework = finding.framework ?? "custom-ai-cli-harness";
  const provider = finding.provider === "unknown" ? "unknown" : finding.provider;
  const runner = cliRunnerName(finding);
  return `import { createCliHarness } from "@spectyra/sdk/cli";

const aiCli = createCliHarness({
  command: "${command === "your-ai-command" ? "your-ai-command" : command}",
  provider: "${provider}",
  framework: "${framework}",
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

export async function ${runner}(prompt: string) {
  return aiCli.run({
    prompt,
    metadata: {
      framework: "${framework}",
      taskType: "agent",
    },
  });
}
`;
}

function importPathForWrapper(wrapperFile: string): string {
  const wrapperName = wrapperFile.split("/").pop()?.replace(/\.[cm]?[tj]sx?$/, "") ?? "aiCliHarness";
  return `./lib/ai/${wrapperName}`;
}

function languageForFinding(finding: AiUsageFinding): DoctorCodeBlock["language"] {
  if (finding.relativePath.endsWith(".tsx")) return "tsx";
  if (finding.relativePath.endsWith(".jsx")) return "jsx";
  if (finding.relativePath.endsWith(".js") || finding.relativePath.endsWith(".mjs") || finding.relativePath.endsWith(".cjs")) return "js";
  return "ts";
}
