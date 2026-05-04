import { createCliHarness, type CliHarnessOptions } from "./createCliHarness.js";

export function createClaudeCliHarness(options: Partial<CliHarnessOptions> = {}) {
  return createCliHarness({
    command: "claude",
    provider: "anthropic",
    framework: "claude-cli-harness",
    defaultArgs: ["--output-format", "json"],
    outputFormat: "json",
    ...options,
  });
}
