import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { scanFileForAiCalls } from "./aiCallScanner.js";

describe("aiCallScanner", () => {
  it("collects multiple AI call patterns in one file", () => {
    const root = join(tmpdir(), `spectyra-doctor-ai-${Date.now()}`);
    mkdirSync(root, { recursive: true });
    const file = join(root, "api.ts");
    writeFileSync(
      file,
      `
export async function a() {
  await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST" });
}
export async function b() {
  await fetch("https://api.openai.com/v1/chat/completions", { method: "POST" });
}
`,
      "utf8",
    );
    try {
      const sites = scanFileForAiCalls(root, file);
      const fetchSites = sites.filter((s) => s.kind === "fetch");
      expect(fetchSites.length).toBeGreaterThanOrEqual(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
