import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createMonitorEngine } from "../monitor/monitorEngine.js";
import type { SpectyraMonitorProvider } from "../monitor/monitorTypes.js";

export interface CliHarnessOptions {
  command: string;
  provider?: string;
  framework?: string;
  defaultArgs?: string[];
  runMode?: "on" | "off" | "monitor";
  licenseKey?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  preserveStreaming?: boolean;
  outputFormat?: "text" | "json" | "stream-json" | "unknown";
  throwOnNonZeroExit?: boolean;
}

export interface CliHarnessRunOptions {
  prompt?: string;
  args?: string[];
  stdin?: string;
  metadata?: Record<string, unknown>;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: Buffer | string) => void;
  onStderr?: (chunk: Buffer | string) => void;
  signal?: AbortSignal;
}

export interface CliHarnessRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  estimatedInputChars: number;
  estimatedOutputChars: number;
  command: string;
  args: string[];
  provider?: string;
  framework?: string;
  metadata?: Record<string, unknown>;
}

export function createCliHarness(options: CliHarnessOptions) {
  const base = {
    defaultArgs: [] as string[],
    runMode: "on" as const,
    env: process.env,
    outputFormat: "unknown" as const,
    throwOnNonZeroExit: true,
    ...options,
  };

  const monitor = createMonitorEngine({
    enabled: base.runMode !== "off",
    jsonl: { enabled: true },
    console: { enabled: false },
    defaults: {
      integrationMode: "cli_harness",
      service: base.framework,
    },
  });

  return {
    async run(runOptions: CliHarnessRunOptions): Promise<CliHarnessRunResult> {
      const startedAt = Date.now();
      const promptOrStdin = runOptions.prompt ?? runOptions.stdin ?? "";
      const args = buildArgs(base.defaultArgs, runOptions.args ?? [], runOptions.prompt);
      const env = { ...base.env, ...(runOptions.env ?? {}) };

      let stdout = "";
      let stderr = "";

      const child = spawn(base.command, args, {
        cwd: runOptions.cwd ?? base.cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        signal: runOptions.signal,
      });

      if (runOptions.stdin) {
        child.stdin.write(runOptions.stdin);
        child.stdin.end();
      } else {
        child.stdin.end();
      }

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        runOptions.onStdout?.(chunk);
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
        runOptions.onStderr?.(chunk);
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code) => resolve(code ?? 0));
      });

      const durationMs = Date.now() - startedAt;
      const metadata = {
        ...(runOptions.metadata ?? {}),
        spectyra: {
          promptHash: hashText(promptOrStdin),
          outputHash: hashText(stdout),
          runMode: base.runMode,
          outputFormat: base.outputFormat,
        },
      };

      const result: CliHarnessRunResult = {
        stdout,
        stderr,
        exitCode,
        durationMs,
        estimatedInputChars: promptOrStdin.length,
        estimatedOutputChars: stdout.length,
        command: base.command,
        args,
        provider: base.provider,
        framework: base.framework,
        metadata,
      };

      emitCliHarnessMonitorEvent(result, base.outputFormat).catch(() => undefined);

      if (exitCode !== 0 && base.throwOnNonZeroExit) {
        const err = new Error(
          `${base.command} exited with code ${exitCode}${stderr ? `: ${stderr.slice(0, 500)}` : ""}`,
        ) as Error & { result?: CliHarnessRunResult };
        err.result = result;
        throw err;
      }

      return result;
    },
  };

  async function emitCliHarnessMonitorEvent(
    result: CliHarnessRunResult,
    outputFormat: CliHarnessOptions["outputFormat"],
  ): Promise<void> {
    monitor.recordEvent({
      provider: normalizeCliMonitorProvider(result.provider),
      latencyMs: result.durationMs,
      success: result.exitCode === 0,
      integrationMode: "cli_harness",
      pricingSource: "size_approximation",
      optimizerApplied: false,
      optimizerStatus: "not_integrated",
      metadataOnly: true,
      toolName: result.command,
      operationName: result.framework ?? "ai-cli-harness",
      workflowType: String(result.metadata?.taskType ?? result.metadata?.workflowType ?? "cli-harness"),
      endpoint: `${result.command} ${redactedArgs(result.args)}`.trim(),
      statusCode: result.exitCode,
      promptLengthChars: result.estimatedInputChars,
      responseLengthChars: result.estimatedOutputChars,
      streaming: outputFormat === "stream-json" || base.preserveStreaming === true,
    });
  }
}

export function buildArgs(defaultArgs: string[], args: string[], prompt?: string): string[] {
  const all = [...defaultArgs, ...args];
  if (!prompt) return all;

  const hasPromptFlag = all.includes("-p") || all.includes("--print") || all.includes("--prompt");
  if (hasPromptFlag) return [...all, prompt];

  return [...all, "-p", prompt];
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function normalizeCliMonitorProvider(provider?: string): SpectyraMonitorProvider {
  if (
    provider === "openai" ||
    provider === "anthropic" ||
    provider === "google-gemini" ||
    provider === "groq" ||
    provider === "azure-openai" ||
    provider === "aws-bedrock" ||
    provider === "mistral" ||
    provider === "cohere" ||
    provider === "openrouter" ||
    provider === "together" ||
    provider === "perplexity"
  ) {
    return provider;
  }
  if (provider === "gemini" || provider === "google") return "google-gemini";
  return "unknown";
}

function redactedArgs(args: string[]): string {
  return args
    .map((arg) => {
      if (arg.length > 80) return "<arg>";
      if (/sk-|key|token|secret|password/i.test(arg)) return "<redacted>";
      return arg;
    })
    .join(" ");
}
