import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { redactSnippet } from "../utils/redact.js";
import type { AiCallSite } from "./types.js";
import { scanTextForProviders } from "./providerScanner.js";

const PATTERNS: Array<{
  re: RegExp;
  kind: AiCallSite["kind"];
}> = [
  { re: /\bfetch\s*\(/, kind: "fetch" },
  { re: /\baxios\.(get|post|put|delete|patch|request)\s*\(/, kind: "axios" },
  { re: /\bhttp\.request\s*\(/, kind: "http" },
  { re: /\bhttps\.request\s*\(/, kind: "https" },
  { re: /\.chat\.completions\.create\s*\(/, kind: "openai-sdk" },
  { re: /\.responses\.create\s*\(/, kind: "openai-sdk" },
  { re: /\.messages\.create\s*\(/, kind: "anthropic-sdk" },
  { re: /\.generateContent\s*\(/, kind: "gemini-sdk" },
  { re: /\binvokeModel\s*\(/, kind: "bedrock-sdk" },
  { re: /\bstreamText\s*\(/, kind: "vercel-ai-sdk" },
  { re: /\bgenerateText\s*\(/, kind: "vercel-ai-sdk" },
  { re: /\bembeddings\.create\s*\(/, kind: "openai-sdk" },
  { re: /\bllm\.invoke\s*\(/, kind: "langchain" },
  { re: /from\s+['"]openai['"]|from\s+['"]@anthropic-ai\/sdk['"]|from\s+['"]groq-sdk['"]|from\s+['"]ai['"]/, kind: "unknown" },
];

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function extractEnvVarsInFile(content: string): string[] {
  const names = new Set<string>();
  for (const m of content.matchAll(/\bprocess\.env\.([A-Z0-9_]+)\b/g)) {
    names.add(m[1]!);
  }
  for (const m of content.matchAll(/\bos\.environ\[['"]([A-Z0-9_]+)['"]\]/g)) {
    names.add(m[1]!);
  }
  return [...names];
}

export function scanFileForAiCalls(projectRoot: string, absPath: string): AiCallSite[] {
  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    return [];
  }
  const rel = relative(projectRoot, absPath).replace(/\\/g, "/");
  const sites: AiCallSite[] = [];
  const envVars = extractEnvVarsInFile(content);

  for (const { re, kind } of PATTERNS) {
    const m = re.exec(content);
    if (!m) continue;
    const line = lineOf(content, m.index);
    const start = Math.max(0, m.index - 80);
    const snippet = redactSnippet(content.slice(start, m.index + 120));
    const providers = scanTextForProviders(content, rel);
    const urlHint =
      content.match(/https?:\/\/[^\s"'`)]+/)?.[0] ??
      (/\/chat\/completions/.test(content) ? "/chat/completions" : undefined);

    sites.push({
      file: rel,
      line,
      kind,
      provider: providers[0]?.provider,
      urlHint,
      envVars: envVars.filter((e) => /API|KEY|URL|HOST|TOKEN/i.test(e)),
      confidence: /chat\/completions|api\.(openai|groq|anthropic)/i.test(content) ? "high" : "medium",
      snippet,
    });
    break;
  }

  if (sites.length === 0 && /\/chat\/completions|responses\.create|messages\.create/i.test(content)) {
    sites.push({
      file: rel,
      kind: "unknown",
      envVars,
      confidence: "medium",
      snippet: redactSnippet(content.slice(0, 200)),
    });
  }

  return sites;
}

export function scanAllAiCalls(projectRoot: string, files: string[]): AiCallSite[] {
  const all: AiCallSite[] = [];
  for (const f of files) {
    all.push(...scanFileForAiCalls(projectRoot, f));
  }
  const key = (s: AiCallSite) => `${s.file}:${s.line}:${s.kind}`;
  const seen = new Set<string>();
  return all.filter((s) => {
    const k = key(s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
