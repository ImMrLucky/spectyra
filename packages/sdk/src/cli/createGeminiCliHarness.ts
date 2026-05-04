import { createCliHarness, type CliHarnessOptions } from "./createCliHarness.js";

export function createGeminiCliHarness(options: Partial<CliHarnessOptions> = {}) {
  return createCliHarness({
    command: "gemini",
    provider: "gemini",
    framework: "gemini-cli-harness",
    defaultArgs: [],
    outputFormat: "text",
    ...options,
  });
}
