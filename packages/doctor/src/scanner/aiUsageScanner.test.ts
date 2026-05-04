import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { scanAiUsage } from "./aiUsageScanner.js";
import type { ScannableFile } from "./types.js";

describe("scanAiUsage", () => {
  function scanSingle(relativePath: string, content: string, language = "typescript") {
    const root = join(tmpdir(), `spectyra-aiu-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const full = join(root, relativePath);
    mkdirSync(full.split("/").slice(0, -1).join("/"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t" }), "utf8");
    writeFileSync(full, content, "utf8");
    const files: ScannableFile[] = [{ path: full, relativePath, extension: relativePath.split(".").pop(), language, sizeBytes: content.length, reason: "t" }];
    return {
      root,
      hits: scanAiUsage(root, files, { primaryEntry: "src/main.ts", manifestAbsPaths: [join(root, "package.json")] }),
    };
  }

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

  it("detects Claude CLI child process usage", () => {
    const { root, hits } = scanSingle(
      "src/agent.ts",
      `import { spawn } from "node:child_process";
export function run(prompt: string) {
  return spawn("claude", ["-p", prompt]);
}`,
    );
    try {
      const cli = hits.find((h) => h.callStyle === "cli" && h.cliTool === "claude");
      expect(cli?.provider).toBe("anthropic");
      expect(cli?.framework).toBe("claude-cli-harness");
      expect(cli?.usageType).toBe("agent");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects provider SDK and CLI harness independently in the same file", () => {
    const { root, hits } = scanSingle(
      "src/both.ts",
      `import OpenAI from "openai";
import { execa } from "execa";
const openai = new OpenAI();
export async function runBoth(messages, prompt) {
  const completion = await openai.chat.completions.create({ model: "gpt-4o-mini", messages });
  const agent = await execa("claude", ["-p", prompt]);
  return { completion, agent };
}`,
    );
    try {
      expect(hits.some((h) => h.callStyle === "sdk" && h.provider === "openai")).toBe(true);
      expect(hits.some((h) => h.callStyle === "cli" && h.provider === "anthropic" && h.cliTool === "claude")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects shell CLI usage but not prose", () => {
    const root = join(tmpdir(), `spectyra-aiu-shell-${Date.now()}`);
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t", scripts: { agent: "codex \"fix this bug\"" } }), "utf8");
    const sh = join(root, "agent.sh");
    const md = join(root, "README.md");
    writeFileSync(sh, "claude --output-format stream-json -p \"$PROMPT\"\n", "utf8");
    writeFileSync(md, "We use Claude for coding.\n", "utf8");
    try {
      const files: ScannableFile[] = [
        { path: join(root, "package.json"), relativePath: "package.json", extension: ".json", language: "json", sizeBytes: 80, reason: "t" },
        { path: sh, relativePath: "agent.sh", extension: ".sh", language: "shell", sizeBytes: 80, reason: "t" },
        { path: md, relativePath: "README.md", extension: ".md", language: "markdown", sizeBytes: 80, reason: "t" },
      ];
      const hits = scanAiUsage(root, files, { primaryEntry: "src/main.ts", manifestAbsPaths: [join(root, "package.json")] });
      expect(hits.some((h) => h.cliTool === "codex" && h.provider === "openai")).toBe(true);
      expect(hits.some((h) => h.cliTool === "claude" && h.isStreaming)).toBe(true);
      expect(hits.every((h) => h.relativePath !== "README.md")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects HTTP AI usage but ignores generic HTTP", () => {
    const { root, hits } = scanSingle(
      "src/http.ts",
      `await fetch("/api/users");
await axios.get("/health");
await fetch("https://api.openai.com/v1/responses", {
  headers: { Authorization: \`Bearer \${process.env.OPENAI_API_KEY}\` },
});
`,
    );
    try {
      expect(hits.some((h) => h.callStyle === "http" && h.provider === "openai")).toBe(true);
      expect(hits.every((h) => h.callStyle !== "http" || h.line > 2)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores generic process launches", () => {
    const { root, hits } = scanSingle(
      "src/processes.ts",
      `import { spawn } from "node:child_process";
spawn("git", ["status"]);
spawn("npm", ["test"]);
spawn("bash", ["deploy.sh"]);
spawn(toolName, params);
`,
    );
    try {
      expect(hits.some((h) => h.callStyle === "cli")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves simple constants, npm scripts, and shell scripts for AI CLI usage", () => {
    const root = join(tmpdir(), `spectyra-aiu-resolve-${Date.now()}`);
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t", scripts: { agent: "claude -p \"fix tests\"", test: "vitest" } }), "utf8");
    writeFileSync(join(root, "scripts", "agent.sh"), "claude -p \"$PROMPT\"\n", "utf8");
    const p = join(root, "src", "resolve.ts");
    writeFileSync(
      p,
      `import { spawn } from "node:child_process";
const cmd = "claude";
const args = ["-p", prompt];
spawn(cmd, args);
spawn("npm", ["run", "agent"]);
spawn("bash", ["scripts/agent.sh"]);
`,
      "utf8",
    );
    try {
      const files: ScannableFile[] = [
        { path: p, relativePath: "src/resolve.ts", extension: ".ts", language: "typescript", sizeBytes: 300, reason: "t" },
      ];
      const hits = scanAiUsage(root, files, { primaryEntry: "src/main.ts", manifestAbsPaths: [join(root, "package.json")] });
      expect(hits.some((h) => h.providerEvidence.some((e) => e.includes("script:agent")))).toBe(true);
      expect(hits.some((h) => h.providerEvidence.some((e) => e.includes("shell-script:scripts/agent.sh")))).toBe(true);
      expect(hits.some((h) => h.methodName === "spawn" && h.command === "claude")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects persistent Claude CLI sessions", () => {
    const { root, hits } = scanSingle(
      "src/session.ts",
      `import { spawn } from "node:child_process";
const child = spawn("claude", []);
child.stdin.write(prompt);
child.stdout.on("data", cb);
`,
    );
    try {
      const session = hits.find((h) => h.cliRunMode === "persistent-session");
      expect(session?.cliTool).toBe("claude");
      expect(session?.usesStdin).toBe(true);
      expect(session?.readsStdoutStream).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects custom AI CLI with model evidence but not unresolved custom commands", () => {
    const { root, hits } = scanSingle(
      "src/custom.ts",
      `import { spawn } from "node:child_process";
spawn("company-agent", ["--model", "claude-3-5-sonnet", "--prompt", prompt]);
spawn(toolName, params);
`,
    );
    try {
      expect(hits.some((h) => h.cliTool === "custom-ai-cli" && h.command === "company-agent")).toBe(true);
      expect(hits.every((h) => h.command !== "toolName")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects ACP harnesses and keeps prose low-confidence", () => {
    const strong = scanSingle(
      "src/acp.ts",
      `import { createClient } from "@zed-industries/agent-client-protocol";
client.request("session/prompt", params);
`,
    );
    const prose = scanSingle("README.md", "We use Claude for coding sometimes.\n", "markdown");
    try {
      expect(strong.hits.some((h) => h.callStyle === "acp" && h.isAcpHarness && h.confidence >= 0.85)).toBe(true);
      expect(prose.hits.every((h) => h.confidence < 0.65)).toBe(true);
    } finally {
      rmSync(strong.root, { recursive: true, force: true });
      rmSync(prose.root, { recursive: true, force: true });
    }
  });
});
