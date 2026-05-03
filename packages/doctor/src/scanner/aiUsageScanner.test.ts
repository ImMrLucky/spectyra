import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { scanAiUsage } from "./aiUsageScanner.js";
import type { ScannableFile } from "./types.js";

describe("scanAiUsage", () => {
  it("detects OpenAI SDK import", () => {
    const root = join(tmpdir(), `spectyra-aiu-${Date.now()}`);
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t" }), "utf8");
    const p = join(root, "src", "x.ts");
    writeFileSync(
      p,
      `import OpenAI from "openai";
const c = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
await c.chat.completions.create({ model: "gpt-4o-mini", messages: [] });
`,
      "utf8",
    );
    try {
      const files: ScannableFile[] = [
        { path: p, relativePath: "src/x.ts", extension: ".ts", language: "typescript", sizeBytes: 200, reason: "t" },
      ];
      const hits = scanAiUsage(root, files, { primaryEntry: "src/main.ts", manifestAbsPaths: [join(root, "package.json")] });
      expect(hits.some((h) => h.provider === "openai")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects Mistral npm SDK", () => {
    const root = join(tmpdir(), `spectyra-aiu-m-${Date.now()}`);
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t" }), "utf8");
    const p = join(root, "src", "m.ts");
    writeFileSync(
      p,
      `import { Mistral } from "@mistralai/mistralai";
const c = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
`,
      "utf8",
    );
    try {
      const files: ScannableFile[] = [
        { path: p, relativePath: "src/m.ts", extension: ".ts", language: "typescript", sizeBytes: 200, reason: "t" },
      ];
      const hits = scanAiUsage(root, files, { primaryEntry: "src/main.ts", manifestAbsPaths: [join(root, "package.json")] });
      expect(hits.some((h) => h.provider === "mistral")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects OpenAI Python import", () => {
    const root = join(tmpdir(), `spectyra-aiu-py-${Date.now()}`);
    mkdirSync(join(root, "lib"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t" }), "utf8");
    const p = join(root, "lib", "chat.py");
    writeFileSync(
      p,
      `from openai import OpenAI
client = OpenAI()
client.chat.completions.create(model="gpt-4o-mini", messages=[])
`,
      "utf8",
    );
    try {
      const files: ScannableFile[] = [
        { path: p, relativePath: "lib/chat.py", extension: ".py", language: "python", sizeBytes: 200, reason: "t" },
      ];
      const hits = scanAiUsage(root, files, { primaryEntry: "lib/main.py", manifestAbsPaths: [join(root, "package.json")] });
      expect(hits.some((h) => h.provider === "openai")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
