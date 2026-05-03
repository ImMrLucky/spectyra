import { parse } from "@babel/parser";
import type { NodePath } from "@babel/traverse";
import babelTraverse from "@babel/traverse";
import type { CallExpression, Expression, NewExpression, ObjectMethod, ObjectProperty, SpreadElement } from "@babel/types";
import type { AiCallStyle, AiProviderId, AiUsageType } from "./types.js";

export interface JsTsAstPartialHit {
  /** Byte offset in source for deduplication with regex scanner */
  index: number;
  line: number;
  column?: number;
  provider: AiProviderId;
  usageType: AiUsageType;
  callStyle: AiCallStyle;
  methodName?: string;
  modelHints: string[];
  envHints: string[];
  urlHints: string[];
  providerEvidence: string[];
  isStreaming?: boolean;
  confidence: number;
}

const MODEL_RE =
  /\b(gpt-4o|gpt-4o-mini|gpt-4\.1|gpt-4\.1-mini|gpt-5|o1|o3|o4|claude-3(?:[-\w.]*)?|claude-sonnet|claude-opus|claude-haiku|gemini-1\.5|gemini-2(?:[-\w.]*)?|llama-?3(?:[-\w.]*)?|llama-?4(?:[-\w.]*)?|mixtral[-\w.]*|mistral[-\w.]*|command-r[-\w.]*|deepseek[-\w.]*|qwen[-\w.]*|sonar[-\w.]*|text-embedding[-\w.]*|embedding[-\w.]*)\b/gi;

const ENV_RE =
  /\b(OPENAI_API_KEY|ANTHROPIC_API_KEY|GROQ_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|AZURE_OPENAI_API_KEY|AZURE_OPENAI_ENDPOINT|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_REGION|MISTRAL_API_KEY|COHERE_API_KEY|OPENROUTER_API_KEY|TOGETHER_API_KEY|PERPLEXITY_API_KEY|OLLAMA_HOST|OPENAI_BASE_URL|AI_BASE_URL|LLM_BASE_URL)\b/g;

const URL_RE =
  /\b(api\.openai\.com|api\.anthropic\.com|api\.groq\.com|generativelanguage\.googleapis\.com|openai\.azure\.com|bedrock-runtime|bedrock\.amazonaws\.com|api\.mistral\.ai|api\.cohere\.ai|openrouter\.ai|api\.together\.xyz|api\.perplexity\.ai|localhost:11434|127\.0\.0\.1:11434)\b/g;

const AI_PATH =
  /\/v1\/(chat\/completions|completions|responses|messages|embeddings|images|audio|moderations|rerank)|\/api\/(generate|chat)|\/models\/generateContent/i;

const AI_METHOD_SUFFIXES: Array<{
  suffix: string;
  usageType: AiUsageType;
  provider?: AiProviderId;
  isStreaming?: boolean;
}> = [
  { suffix: "chat.completions.create", usageType: "chat" },
  { suffix: "chat.completions.parse", usageType: "chat" },
  { suffix: "chat.completions.stream", usageType: "streaming", isStreaming: true },
  { suffix: "responses.create", usageType: "responses" },
  { suffix: "responses.stream", usageType: "responses", isStreaming: true },
  { suffix: "embeddings.create", usageType: "embedding" },
  { suffix: "images.generate", usageType: "image" },
  { suffix: "audio.transcriptions.create", usageType: "audio" },
  { suffix: "audio.speech.create", usageType: "audio" },
  { suffix: "moderations.create", usageType: "moderation" },
  { suffix: "messages.create", usageType: "chat" },
  { suffix: "messages.stream", usageType: "streaming", isStreaming: true },
  { suffix: "beta.messages.create", usageType: "chat" },
  { suffix: "beta.threads.create", usageType: "agent" },
  { suffix: "beta.threads.runs.create", usageType: "agent" },
  { suffix: "beta.threads.runs.stream", usageType: "streaming", isStreaming: true },
  { suffix: "models.generateContent", usageType: "chat", provider: "gemini" },
  { suffix: "models.generateContentStream", usageType: "streaming", provider: "gemini", isStreaming: true },
  { suffix: "generateContent", usageType: "chat", provider: "gemini" },
  { suffix: "generateContentStream", usageType: "streaming", provider: "gemini", isStreaming: true },
  { suffix: "invokeModel", usageType: "chat", provider: "aws-bedrock" },
  { suffix: "invokeModelWithResponseStream", usageType: "streaming", provider: "aws-bedrock", isStreaming: true },
];

const VERCEL_AI_FUNCTIONS: Record<string, { usageType: AiUsageType; isStreaming?: boolean }> = {
  streamText: { usageType: "streaming", isStreaming: true },
  generateText: { usageType: "chat" },
  generateObject: { usageType: "tool-calling" },
  streamObject: { usageType: "tool-calling", isStreaming: true },
  embed: { usageType: "embedding" },
  embedMany: { usageType: "embedding" },
  experimental_generateImage: { usageType: "image" },
};

const PROVIDER_IMPORTS: Record<string, AiProviderId> = {
  openai: "openai",
  "@anthropic-ai/sdk": "anthropic",
  "groq-sdk": "groq",
  "@google/generative-ai": "gemini",
  "@google/genai": "gemini",
  "@azure/openai": "azure-openai",
  "@aws-sdk/client-bedrock-runtime": "aws-bedrock",
  ai: "vercel-ai-sdk",
  "@ai-sdk/openai": "openai",
  "@ai-sdk/anthropic": "anthropic",
  "@ai-sdk/google": "gemini",
  "@ai-sdk/groq": "groq",
  "@langchain/openai": "langchain",
  "@langchain/anthropic": "langchain",
};

const HTTP_CHAIN_SUFFIXES = [
  "fetch",
  "axios.post",
  "axios.request",
  "got.post",
  "ky.post",
  "superagent.post",
  "request.post",
  "http.request",
  "https.request",
  "undici.request",
];

function getMemberChain(node: Expression | null | undefined): string | undefined {
  if (!node) return undefined;
  const t = node.type;
  if (t === "Identifier") return (node as { name: string }).name;
  if (t === "ThisExpression") return "this";
  if (t === "Super") return "super";
  if (t === "CallExpression" || t === "OptionalCallExpression") {
    const c = (node as CallExpression).callee as Expression;
    return getMemberChain(c);
  }
  if (t === "MemberExpression" || t === "OptionalMemberExpression") {
    const m = node as import("@babel/types").MemberExpression;
    const obj = getMemberChain(m.object as Expression);
    let prop: string | undefined;
    const p = m.property;
    if (!m.computed && p.type === "Identifier") prop = p.name;
    else if (p.type === "StringLiteral") prop = p.value;
    else if (p.type === "NumericLiteral") prop = String(p.value);
    return obj && prop ? `${obj}.${prop}` : prop;
  }
  return undefined;
}

function chainEndsWith(chain: string, suffix: string): boolean {
  return chain === suffix || chain.endsWith(`.${suffix}`);
}

function matches(text: string, re: RegExp): string[] {
  const out: string[] = [];
  re.lastIndex = 0;
  for (const m of text.matchAll(re)) {
    if (m[0]) out.push(m[0]);
  }
  return out;
}

function uniqueStrings(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))];
}

function objectKey(prop: ObjectProperty | ObjectMethod): string | undefined {
  const k = prop.key;
  if (k.type === "Identifier") return k.name;
  if (k.type === "StringLiteral") return k.value;
  return undefined;
}

function extractObjectArgInfo(call: CallExpression | NewExpression): {
  modelHints: string[];
  isStreaming?: boolean;
  usageType?: AiUsageType;
} {
  const modelHints: string[] = [];
  let isStreaming: boolean | undefined;
  let usageType: AiUsageType | undefined;
  for (const arg of call.arguments) {
    if (arg.type === "SpreadElement") continue;
    if (arg.type !== "ObjectExpression") continue;
    for (const prop of arg.properties) {
      if (prop.type === "SpreadElement") continue;
      if (prop.type !== "ObjectProperty") continue;
      const key = objectKey(prop);
      if (!key) continue;
      const v = prop.value;
      if (["model", "modelName", "deployment", "deploymentName"].includes(key) && v.type === "StringLiteral") {
        modelHints.push(v.value);
      }
      if (key === "stream" && v.type === "BooleanLiteral" && v.value) isStreaming = true;
      if (key === "tools" || key === "tool_choice" || key === "toolChoice") usageType = "tool-calling";
    }
  }
  return { modelHints, isStreaming, usageType };
}

function providerFromConstructorName(name: string): AiProviderId | undefined {
  if (name === "AzureOpenAI" || name === "OpenAIClient") return "azure-openai";
  if (name === "OpenAI" || name.endsWith("OpenAI")) return "openai";
  if (name.endsWith("Anthropic")) return "anthropic";
  if (name.endsWith("Groq")) return "groq";
  if (name.includes("BedrockRuntime")) return "aws-bedrock";
  if (name.endsWith("Mistral")) return "mistral";
  if (name.endsWith("CohereClient") || name.endsWith("Cohere")) return "cohere";
  return undefined;
}

function inferProviderFromEvidence(input: {
  imported: Set<AiProviderId>;
  modelHints: string[];
  envHints: string[];
  urlHints: string[];
  chain?: string;
  fallback?: AiProviderId;
}): AiProviderId {
  const provs = [...input.imported];
  if (provs.length === 1) return provs[0]!;
  if (provs.length === 0 && input.fallback) return input.fallback;
  const evidence = [...input.modelHints, ...input.envHints, ...input.urlHints, input.chain ?? ""].join(" ").toLowerCase();
  if (evidence.includes("anthropic") || evidence.includes("claude")) return "anthropic";
  if (evidence.includes("groq")) return "groq";
  if (evidence.includes("gemini") || evidence.includes("google")) return "gemini";
  if (evidence.includes("azure")) return "azure-openai";
  if (evidence.includes("bedrock") || evidence.includes("invoke")) return "aws-bedrock";
  if (evidence.includes("openrouter")) return "openrouter";
  if (evidence.includes("together")) return "together";
  if (evidence.includes("perplexity") || evidence.includes("sonar")) return "perplexity";
  if (evidence.includes("mistral") || evidence.includes("mixtral")) return "mistral";
  if (evidence.includes("cohere") || evidence.includes("command-r")) return "cohere";
  if (evidence.includes("ollama") || evidence.includes("11434")) return "ollama";
  if (evidence.includes("openai") || evidence.includes("gpt-") || /\bo[134]\b/.test(evidence)) return "openai";
  if ((input.chain ?? "").includes("chat.completions")) return "openai-compatible";
  return "unknown";
}

function inferUsageFromText(text: string): AiUsageType {
  const lower = text.toLowerCase();
  if (lower.includes("embedding")) return "embedding";
  if (lower.includes("rerank")) return "rerank";
  if (lower.includes("image")) return "image";
  if (lower.includes("audio") || lower.includes("transcription") || lower.includes("speech")) return "audio";
  if (lower.includes("moderation")) return "moderation";
  if (lower.includes("responses")) return "responses";
  return "chat";
}

function httpChainMatches(chain: string): boolean {
  for (const s of HTTP_CHAIN_SUFFIXES) {
    if (chain === s || chain.endsWith(`.${s}`) || chain.endsWith(`?.${s}`)) return true;
  }
  return false;
}

function collectRequireProvider(call: CallExpression, imported: Set<AiProviderId>): void {
  const callee = call.callee;
  if (callee.type !== "Identifier" || callee.name !== "require") return;
  const arg0 = call.arguments[0];
  if (!arg0 || arg0.type !== "StringLiteral") return;
  const p = PROVIDER_IMPORTS[arg0.value];
  if (p) imported.add(p);
}

type TraverseFn = (tree: import("@babel/types").File, opts: object) => void;

function resolveTraverse(): TraverseFn | undefined {
  const mod = babelTraverse as unknown as {
    default?: unknown;
    traverse?: unknown;
  };
  if (typeof babelTraverse === "function") return babelTraverse as unknown as TraverseFn;
  if (typeof mod.default === "function") return mod.default as TraverseFn;
  if (mod.default && typeof (mod.default as { default?: unknown }).default === "function") {
    return (mod.default as { default: TraverseFn }).default;
  }
  if (typeof mod.traverse === "function") return mod.traverse as TraverseFn;
  return undefined;
}

/** AST-assisted scan for JS/TS/JSX; returns partial hits merged by {@link scanAiUsage}. */
export function scanJsTsAstSource(source: string): JsTsAstPartialHit[] {
  const lines = source.split(/\r?\n/);
  const imported = new Set<AiProviderId>();
  const hits: JsTsAstPartialHit[] = [];

  let ast: import("@babel/types").File | null = null;
  try {
    ast = parse(source, {
      sourceType: "unambiguous",
      errorRecovery: true,
      allowReturnOutsideFunction: true,
      plugins: [
        "typescript",
        "jsx",
        "decorators-legacy",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        "dynamicImport",
        "importMeta",
        "topLevelAwait",
        "objectRestSpread",
        "optionalChaining",
        "nullishCoalescingOperator",
      ],
    }) as import("@babel/types").File;
  } catch {
    return [];
  }

  const snippetFor = (line: number) => {
    const i = Math.max(0, line - 1);
    return lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 2)).join("\n").trim();
  };

  const pushHit = (h: Omit<JsTsAstPartialHit, "index"> & { start?: number | null }) => {
    const line = h.line;
    const text = `${snippetFor(line)}\n${h.methodName ?? ""}`;
    const modelHints = uniqueStrings([...h.modelHints, ...matches(text, MODEL_RE)]);
    const envHints = uniqueStrings([...h.envHints, ...matches(text, ENV_RE)]);
    const urlHints = uniqueStrings([...h.urlHints, ...matches(text, URL_RE)]);
    hits.push({
      ...h,
      modelHints,
      envHints,
      urlHints,
      index: h.start ?? lines.slice(0, line - 1).join("\n").length + line,
    });
  };

  const traverse = resolveTraverse();
  if (!traverse) return [];

  traverse(ast, {
    ImportDeclaration(path: NodePath<import("@babel/types").ImportDeclaration>) {
      const src = path.node.source.value;
      const p = PROVIDER_IMPORTS[src];
      if (p) imported.add(p);
    },
    CallExpression(path: NodePath<CallExpression>) {
      collectRequireProvider(path.node, imported);
      const chain = getMemberChain(path.node.callee as Expression);
      const loc = path.node.loc?.start;
      const line = loc?.line ?? 1;
      const column = loc?.column;
      const start = path.node.start ?? null;
      if (!chain) return;

      const argText = path.node.arguments
        .filter((a): a is Exclude<(typeof path.node.arguments)[number], SpreadElement> => a.type !== "SpreadElement")
        .map((a) => source.slice(a.start ?? 0, a.end ?? 0))
        .join("\n");
      const local = `${snippetFor(line)}\n${argText}`;

      for (const rule of AI_METHOD_SUFFIXES) {
        if (chainEndsWith(chain, rule.suffix)) {
          const obj = extractObjectArgInfo(path.node);
          const provider = inferProviderFromEvidence({
            imported,
            modelHints: [...obj.modelHints, ...matches(local, MODEL_RE)],
            envHints: matches(local, ENV_RE),
            urlHints: matches(local, URL_RE),
            chain,
            fallback: rule.provider,
          });
          const conf =
            imported.size > 0
              ? 0.95
              : obj.modelHints.length > 0 || matches(local, ENV_RE).length > 0
                ? 0.9
                : 0.88;
          pushHit({
            start,
            line,
            column,
            provider,
            usageType: obj.usageType ?? rule.usageType,
            callStyle: "sdk",
            methodName: chain,
            modelHints: obj.modelHints,
            envHints: [],
            urlHints: [],
            providerEvidence: [`ast:${rule.suffix}`, ...[...imported].map((x) => `import:${x}`)],
            isStreaming: rule.isStreaming || obj.isStreaming,
            confidence: conf,
          });
          return;
        }
      }

      const tail = chain.includes(".") ? (chain.split(".").pop() ?? chain) : chain;
      const vercel = VERCEL_AI_FUNCTIONS[tail];
      if (vercel) {
        const obj = extractObjectArgInfo(path.node);
        const provider = inferProviderFromEvidence({
          imported,
          modelHints: [...obj.modelHints, ...matches(local, MODEL_RE)],
          envHints: matches(local, ENV_RE),
          urlHints: matches(local, URL_RE),
          fallback: "vercel-ai-sdk",
        });
        pushHit({
          start,
          line,
          column,
          provider: provider === "unknown" ? "vercel-ai-sdk" : provider,
          usageType: obj.usageType ?? vercel.usageType,
          callStyle: "framework",
          methodName: chain,
          modelHints: obj.modelHints,
          envHints: [],
          urlHints: [],
          providerEvidence: ["vercel-ai-sdk-fn", ...[...imported].map((x) => `import:${x}`)],
          isStreaming: vercel.isStreaming || obj.isStreaming,
          confidence: 0.85,
        });
        return;
      }

      if (httpChainMatches(chain)) {
        const modelHints = matches(local, MODEL_RE);
        const envHints = matches(local, ENV_RE);
        const urlHints = matches(local, URL_RE);
        const hasAi = urlHints.length > 0 || envHints.length > 0 || modelHints.length > 0 || AI_PATH.test(local);
        if (!hasAi) return;
        const provider = inferProviderFromEvidence({ imported, modelHints, envHints, urlHints, chain });
        const conf = urlHints.length && (modelHints.length || envHints.length) ? 0.9 : 0.78;
        pushHit({
          start,
          line,
          column,
          provider,
          usageType: inferUsageFromText(local),
          callStyle: "http",
          methodName: chain,
          modelHints,
          envHints,
          urlHints,
          providerEvidence: [...urlHints.map((u) => `url:${u}`), ...envHints.map((e) => `env:${e}`)],
          isStreaming: /stream\s*:\s*true|\.stream\s*\(/i.test(local),
          confidence: conf,
        });
      }
    },
    NewExpression(path: NodePath<NewExpression>) {
      const callee = path.node.callee;
      if (callee.type !== "Identifier" && callee.type !== "MemberExpression") return;
      const name = callee.type === "Identifier" ? callee.name : getMemberChain(callee) ?? "";
      const provider = providerFromConstructorName(name);
      if (!provider) return;
      imported.add(provider);
      const loc = path.node.loc?.start;
      const line = loc?.line ?? 1;
      const start = path.node.start ?? null;
      const local = snippetFor(line);
      pushHit({
        start,
        line,
        column: loc?.column,
        provider,
        usageType: "unknown",
        callStyle: "sdk",
        methodName: `new ${name}`,
        modelHints: matches(local, MODEL_RE),
        envHints: matches(local, ENV_RE),
        urlHints: matches(local, URL_RE),
        providerEvidence: [`constructor:${name}`],
        confidence: 0.82,
      });
    },
  });

  const seen = new Set<string>();
  const out: JsTsAstPartialHit[] = [];
  for (const h of hits) {
    const k = `${h.line}|${h.provider}|${h.methodName ?? ""}|${h.usageType}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  return out;
}

export function isJsTsFamilyPath(relativePath: string): boolean {
  return /\.(tsx?|jsx?|mjs|cjs|mts|cts)$/i.test(relativePath);
}
