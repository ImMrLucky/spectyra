import type { AiCliToolId, AiProviderId, AiUsageFinding } from "./types.js";

export interface CliHarnessDetection {
  tool: AiCliToolId;
  provider: AiProviderId;
  framework: string;
  command: string;
  commandArgs: string[];
  isStreaming?: boolean;
  confidence: number;
  evidence: string[];
}

export interface CliToolDefinition {
  id: AiCliToolId;
  provider: AiProviderId;
  framework: string;
  commandNames: string[];
  npmPackageHints: string[];
  strongFlags: string[];
  mediumFlags: string[];
  envHints: string[];
  modelHints: RegExp[];
}

export type CliHarnessFindingHit = Omit<
  AiUsageFinding,
  "id" | "recommendation" | "snippet" | "filePath" | "relativePath" | "language" | "line" | "severity" | "packageDir"
> & {
  index: number;
  snippet?: string;
};

export const AI_CLI_TOOLS: CliToolDefinition[] = [
  {
    id: "claude",
    provider: "anthropic",
    framework: "claude-cli-harness",
    commandNames: ["claude", "claude-code"],
    npmPackageHints: ["@anthropic-ai/claude-code", "@anthropic-ai/claude-agent-sdk", "claude_agent_sdk"],
    strongFlags: [
      "-p",
      "--print",
      "--output-format",
      "--permission-mode",
      "--allowedTools",
      "--disallowedTools",
      "--append-system-prompt",
      "--system-prompt",
    ],
    mediumFlags: ["--model", "--verbose", "--max-turns"],
    envHints: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_"],
    modelHints: [/claude-[\w.-]+/i],
  },
  {
    id: "gemini",
    provider: "gemini",
    framework: "gemini-cli-harness",
    commandNames: ["gemini", "gemini-cli"],
    npmPackageHints: ["@google/gemini-cli", "gemini-cli"],
    strongFlags: ["-p", "--prompt", "--model", "--yolo"],
    mediumFlags: ["--debug", "--all-files"],
    envHints: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    modelHints: [/gemini-[\w.-]+/i],
  },
  {
    id: "codex",
    provider: "openai",
    framework: "codex-cli-harness",
    commandNames: ["codex"],
    npmPackageHints: ["@openai/codex"],
    strongFlags: ["exec", "--model", "-m", "--config", "-c"],
    mediumFlags: ["--sandbox", "--ask-for-approval", "--full-auto"],
    envHints: ["OPENAI_API_KEY"],
    modelHints: [/gpt-[\w.-]+/i, /\bo[134][\w.-]*/i],
  },
  {
    id: "aider",
    provider: "unknown",
    framework: "aider-cli-harness",
    commandNames: ["aider"],
    npmPackageHints: [],
    strongFlags: ["--model", "--api-key", "--openai-api-key", "--anthropic-api-key"],
    mediumFlags: ["--yes", "--message"],
    envHints: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
    modelHints: [/gpt-[\w.-]+/i, /claude-[\w.-]+/i],
  },
  {
    id: "opencode",
    provider: "unknown",
    framework: "opencode-cli-harness",
    commandNames: ["opencode"],
    npmPackageHints: ["opencode"],
    strongFlags: ["run", "--model", "-m"],
    mediumFlags: [],
    envHints: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"],
    modelHints: [/gpt-[\w.-]+/i, /claude-[\w.-]+/i, /gemini-[\w.-]+/i],
  },
];

const EXECUTABLE_FILE_RE =
  /(^|\/)(package\.json|Dockerfile|Makefile|Taskfile\.(ya?ml|json)|\.github\/workflows\/.*\.ya?ml|.*\.(sh|bash|zsh|fish|ps1|ya?ml|json|toml|mk))$/i;
const COMMAND_CONTEXT_RE =
  /\b(spawn|exec|execFile|fork|execa|execaCommand|npx|npm\s+exec|pnpm\s+dlx|bunx|RUN|CMD|ENTRYPOINT|run:|script|scripts)\b/i;
const STREAM_RE = /--output-format\s+stream-json|\bstdout\.on\s*\(\s*["']data["']|for\s+await|\|\s*while\s+read|\bstream\b/i;

export function detectCliHarnessInText(input: {
  text: string;
  relativePath: string;
  language: string;
}): CliHarnessFindingHit[] {
  const out: CliHarnessFindingHit[] = [];
  const lines = input.text.split(/\r?\n/);
  let offset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !isProseOnly(trimmed)) {
      const detection = detectCliHarnessCommand(trimmed, {
        relativePath: input.relativePath,
        language: input.language,
      });
      if (detection) {
        out.push({
          index: offset + Math.max(0, line.indexOf(detection.command)),
          provider: detection.provider,
          providerEvidence: detection.evidence,
          usageType: "agent",
          callStyle: "cli",
          methodName: "cli-command",
          modelHints: [],
          envHints: detection.evidence.filter((x) => /_API_KEY|CLAUDE_CODE_/.test(x)),
          urlHints: [],
          isStreaming: detection.isStreaming,
          confidence: detection.confidence,
          framework: detection.framework,
          command: detection.command,
          commandArgs: detection.commandArgs,
          isCliHarness: true,
          cliTool: detection.tool,
          snippet: trimmed,
        });
      }
    }
    offset += line.length + 1;
  }

  return out;
}

export function detectCliHarnessCommand(
  commandText: string,
  ctx: { relativePath?: string; language?: string } = {},
): CliHarnessDetection | undefined {
  const normalized = commandText.trim();
  if (!normalized) return undefined;

  for (const def of AI_CLI_TOOLS) {
    const command = matchCommandName(normalized, def);
    const packageHint = def.npmPackageHints.find((hint) => new RegExp(`(^|\\s|["'])${escapeRegExp(hint)}(\\s|["']|$)`, "i").test(normalized));
    if (!command && !packageHint) continue;

    const commandName = command ?? packageHintToCommand(def, packageHint);
    const args = extractArgs(normalized, commandName, packageHint);
    const evidence = [commandName, ...args.slice(0, 8)];
    const strong = hasAny(normalized, def.strongFlags);
    const medium = hasAny(normalized, def.mediumFlags);
    const env = def.envHints.filter((hint) => normalized.includes(hint));
    const model = def.modelHints.some((re) => re.test(normalized));
    const executable = isExecutableContext(normalized, ctx.relativePath, ctx.language);

    if (!executable && !strong && !packageHint) continue;
    if (!executable && command && !strong && !medium && !env.length && !model) continue;

    const confidence = confidenceFor({ strong, medium, env: env.length > 0, model, packageHint: Boolean(packageHint), executable });
    if (confidence < 0.65) continue;

    return {
      tool: def.id,
      provider: def.provider,
      framework: def.framework,
      command: commandName,
      commandArgs: args,
      isStreaming: STREAM_RE.test(normalized),
      confidence,
      evidence: [...evidence, ...env, packageHint ? `package:${packageHint}` : ""].filter(Boolean),
    };
  }

  const custom = detectCustomAiCli(normalized, ctx);
  if (custom) return custom;
  return undefined;
}

function matchCommandName(text: string, def: CliToolDefinition): string | undefined {
  for (const name of def.commandNames) {
    const nameRe = escapeRegExp(name);
    const re = new RegExp(
      `(^|[\\s"'` + "`" + `([{;|&])(?:npx\\s+|npm\\s+exec\\s+|pnpm\\s+dlx\\s+|bunx\\s+)?${nameRe}(?=$|[\\s"'` + "`" + `)\\]};&|])`,
      "i",
    );
    if (re.test(text)) return name;
  }
  return undefined;
}

function packageHintToCommand(def: CliToolDefinition, hint?: string): string {
  if (!hint) return def.commandNames[0] ?? "ai-cli";
  if (hint.includes("codex")) return "codex";
  if (hint.includes("gemini")) return "gemini";
  if (hint.includes("claude")) return "claude";
  return def.commandNames[0] ?? hint;
}

function extractArgs(text: string, command: string, packageHint?: string): string[] {
  const needle = packageHint ?? command;
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return [];
  return text
    .slice(idx + needle.length)
    .replace(/[)\]},;]+$/g, "")
    .match(/(?:--?[A-Za-z0-9][\w-]*|"[^"]*"|'[^']*'|`[^`]*`|\S+)/g)
    ?.slice(0, 16)
    .map((x) => x.replace(/^["'`]|["'`]$/g, ""))
    .filter((x) => x && !/^\$\{/.test(x)) ?? [];
}

function detectCustomAiCli(text: string, ctx: { relativePath?: string; language?: string }): CliHarnessDetection | undefined {
  const hasAiCue = /\b(ai|llm|agent|prompt|model|openai|anthropic|gemini|claude|gpt-|ANTHROPIC_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY)\b/i.test(text);
  const hasCommandCue = /\b(spawn|exec|execa|run:|RUN|CMD|ENTRYPOINT|npx|pnpm\s+dlx|bunx)\b/i.test(text) || isExecutableContext(text, ctx.relativePath, ctx.language);
  if (!hasAiCue || !hasCommandCue) return undefined;
  const m = text.match(/(?:spawn|execFile|execa)\s*\(\s*["']([^"']+)["']|(?:^|\s)([A-Za-z0-9._/-]*ai[A-Za-z0-9._/-]*)(?:\s|$)/i);
  const command = m?.[1] ?? m?.[2];
  if (!command || /claude|gemini|codex|aider|opencode/i.test(command)) return undefined;
  return {
    tool: "custom-ai-cli",
    provider: "unknown",
    framework: "custom-ai-cli-harness",
    command,
    commandArgs: extractArgs(text, command),
    isStreaming: STREAM_RE.test(text),
    confidence: 0.72,
    evidence: [command, "custom-ai-cli"],
  };
}

function confidenceFor(input: {
  strong: boolean;
  medium: boolean;
  env: boolean;
  model: boolean;
  packageHint: boolean;
  executable: boolean;
}): number {
  if (input.strong && input.executable) return 0.94;
  if (input.packageHint && input.executable) return 0.9;
  if (input.executable && input.strong) return 0.88;
  if (input.executable && input.medium) return 0.85;
  if (input.env || input.model) return 0.8;
  return input.executable ? 0.68 : 0.4;
}

function isExecutableContext(text: string, relativePath?: string, language?: string): boolean {
  return (
    COMMAND_CONTEXT_RE.test(text) ||
    Boolean(relativePath && EXECUTABLE_FILE_RE.test(relativePath)) ||
    ["shell", "bash", "sh", "yaml", "json", "dockerfile", "makefile"].includes(language ?? "")
  );
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((flag) => new RegExp(`(^|\\s|["'])${escapeRegExp(flag)}(?=$|\\s|["'])`, "i").test(text));
}

function isProseOnly(line: string): boolean {
  return /^[A-Z][^:=(){}[\]`|;&]*\b(claude|gemini|codex|aider|opencode)\b[^:=(){}[\]`|;&]*\.$/i.test(line);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
