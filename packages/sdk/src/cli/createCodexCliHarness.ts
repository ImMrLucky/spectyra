import { createCliHarness, type CliHarnessOptions } from "./createCliHarness.js";

export function createCodexCliHarness(options: Partial<CliHarnessOptions> = {}) {
  return createCliHarness({
    command: "codex",
    provider: "openai",
    framework: "codex-cli-harness",
    defaultArgs: [],
    outputFormat: "text",
    ...options,
  });
}
