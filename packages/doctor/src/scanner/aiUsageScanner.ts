import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  AiCallStyle,
  AiProviderId,
  AiUsageFinding,
  AiUsageType,
  AiCallSite,
  DetectionEvidence,
  EvidenceKind,
  ScannableFile,
} from "./types.js";
import { classifyModelHint, extractModelLiteralsFromText } from "./modelClassifier.js";
import { nearestPackageDirForFile } from "./monorepo.js";
import { isJsTsFamilyPath, scanJsTsAstSource } from "./jsTsAstScanner.js";
import { detectCliHarnessCommand, detectCliHarnessInText } from "./cliHarnessScanner.js";
import { buildSpectyraFindingRecommendation } from "../recommendations/recommendationEngine.js";

const PROVIDER_URL = [
  ["openai", /api\.openai\.com/i],
  ["anthropic", /api\.anthropic\.com/i],
  ["groq", /api\.groq\.com/i],
  ["gemini", /generativelanguage\.googleapis\.com|aiplatform\.googleapis\.com|vertexai\.googleapis\.com/i],
  ["azure-openai", /openai\.azure\.com/i],
  ["aws-bedrock", /bedrock-runtime|bedrock\.amazonaws\.com/i],
  ["mistral", /api\.mistral\.ai/i],
  ["cohere", /api\.cohere\.ai/i],
  ["openrouter", /openrouter\.ai/i],
  ["together", /api\.together\.xyz/i],
  ["perplexity", /api\.perplexity\.ai/i],
  ["deepseek", /api\.deepseek\.com/i],
  ["xai", /api\.x\.ai/i],
  ["fireworks", /api\.fireworks\.ai|inference\.fireworks\.ai/i],
  ["elevenlabs", /api\.elevenlabs\.io/i],
  ["huggingface", /api-inference\.huggingface\.co|router\.huggingface\.co/i],
  ["replicate", /api\.replicate\.com/i],
  ["ollama", /localhost:11434|127\.0\.0\.1:11434/i],
] as const;

const AI_PATH =
  /\/v1\/(chat\/completions|completions|responses|messages|embeddings|images|audio|moderations|realtime)|\/v1beta\/models\/|\/api\/(chat|generate)|\/models\/generateContent|\/v1\/threads\//i;

const ENV_NAMES =
  /\b(OPENAI_API_KEY|ANTHROPIC_API_KEY|GROQ_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|AZURE_OPENAI_API_KEY|AZURE_OPENAI_ENDPOINT|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_REGION|MISTRAL_API_KEY|COHERE_API_KEY|OPENROUTER_API_KEY|TOGETHER_API_KEY|PERPLEXITY_API_KEY|OLLAMA_HOST|OPENAI_BASE_URL|ANTHROPIC_BASE_URL|LLM_BASE_URL|AI_BASE_URL|DEEPSEEK_API_KEY|XAI_API_KEY|FIREWORKS_API_KEY|ELEVENLABS_API_KEY|REPLICATE_API_TOKEN|HUGGINGFACE_HUB_TOKEN|HF_TOKEN|GOOGLE_CLOUD_PROJECT|VERTEX_AI_LOCATION)\b/g;

const ENV_NAMES_TEST = new RegExp(ENV_NAMES.source, "i");

const MODEL_TOKEN = /\b(gpt-[45][^"'`\s]*|o[134][^"'`\s]*|claude[^"'`\s]*|gemini[^"'`\s]*|llama[^"'`\s]*|mixtral|mistral|command-r|deepseek|qwen|sonar|text-embedding-3[^"'`\s]*)\b/i;

const WRAPPER_FN =
  /\b(callLLM|invokeLLM|runLLM|askAI|sendPrompt|completePrompt|streamCompletion|createEmbedding|rerankDocuments|generateAnswer|generateResponse|llmClient|aiClient|modelClient|completionClient|chatClient|agentClient|inferenceClient)\s*\(/i;

const ACP_RE =
  /(@zed-industries\/agent-client-protocol|@agentclientprotocol|agentclientprotocol|agent-client-protocol|acp-client|acp-server|\bacp\b|gemini\s+--experimental-acp|claude-code\s+acp|codex\s+acp|copilot\s+acp|opencode\s+acp|kiro\s+acp)/i;
const ACP_METHOD_RE = /\b(session\/new|session\/prompt|session\/cancel|session\/update|agent\/session|agent\/message|initialize|jsonrpc|JSON-RPC)\b/;

const PYTHON_SDK_RULES: Array<{
  re: RegExp;
  provider: AiProviderId;
  callStyle: AiCallStyle;
  usageType: AiUsageType;
  evidence: string;
}> = [
  { re: /\bfrom\s+openai\s+import\s+OpenAI\b|\bimport\s+openai\b/, provider: "openai", callStyle: "sdk", usageType: "chat", evidence: "openai python" },
  { re: /\bfrom\s+anthropic\s+import\s+Anthropic\b|\bimport\s+anthropic\b/, provider: "anthropic", callStyle: "sdk", usageType: "chat", evidence: "anthropic python" },
  { re: /\bfrom\s+groq\s+import\s+Groq\b|\bimport\s+groq\b/, provider: "groq", callStyle: "sdk", usageType: "chat", evidence: "groq python" },
  { re: /\bimport\s+google\.generativeai\b|\bfrom\s+google\s+import\s+generativeai\b/, provider: "gemini", callStyle: "sdk", usageType: "chat", evidence: "google genai python" },
  {
    re: /\bboto3\.client\s*\(\s*["']bedrock-runtime["']/,
    provider: "aws-bedrock",
    callStyle: "sdk",
    usageType: "chat",
    evidence: "bedrock boto3",
  },
  { re: /\bimport\s+litellm\b|\bfrom\s+litellm\s+import\b/, provider: "litellm", callStyle: "sdk", usageType: "chat", evidence: "litellm python" },
  { re: /\bfrom\s+langchain|import\s+langchain\b|\bfrom\s+langchain_core\b/, provider: "langchain", callStyle: "framework", usageType: "agent", evidence: "langchain python" },
  { re: /\bfrom\s+mistralai\b|\bimport\s+mistralai\b/, provider: "mistral", callStyle: "sdk", usageType: "chat", evidence: "mistral python" },
  { re: /\bfrom\s+cohere\s+import\s+Cohere\b|\bimport\s+cohere\b/, provider: "cohere", callStyle: "sdk", usageType: "chat", evidence: "cohere python" },
  { re: /\bimport\s+ollama\b|\bfrom\s+ollama\s+import\b/, provider: "ollama", callStyle: "sdk", usageType: "chat", evidence: "ollama python" },
  { re: /\bimport\s+replicate\b|\bfrom\s+replicate\s+import\b/, provider: "replicate", callStyle: "sdk", usageType: "chat", evidence: "replicate python" },
  { re: /\bfrom\s+huggingface_hub\s+import|InferenceClient\b/, provider: "huggingface", callStyle: "sdk", usageType: "chat", evidence: "huggingface hub python" },
];

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function snippetAt(text: string, index: number, radius = 100): string {
  const start = Math.max(0, index - radius);
  return text.slice(start, index + radius).replace(/\s+/g, " ").trim().slice(0, 280);
}

function windowAroundLine(text: string, line: number, before = 28, after = 28): string {
  const lines = text.split("\n");
  const i = Math.max(0, line - 1);
  return lines.slice(Math.max(0, i - before), Math.min(lines.length, i + after + 1)).join("\n");
}

function callWindow(text: string, index: number, max = 1200): string {
  const chunk = text.slice(index, index + max);
  return chunk.split(/\n(?=\s*(?:await\s+)?(?:fetch|axios\.|got\.|ky\.|\$fetch|ofetch|undici\.|https?\.request|requests\.|httpx\.|session\.))/i)[0] ?? chunk;
}

function inferUsageType(text: string): AiUsageType {
  if (/streamText|\.stream\(|stream\s*\(|generateContentStream|InvokeModelWithResponseStream/i.test(text)) return "streaming";
  if (/embed|embedding|text-embedding|OpenAIEmbeddings|embedMany|embed\(/i.test(text)) return "embedding";
  if (/rerank|Rerank/i.test(text)) return "rerank";
  if (/images\.generate|image|dall-e|moderations\.create/i.test(text)) return "image";
  if (/audio\.|transcriptions|speech\.create/i.test(text)) return "audio";
  if (/responses\.create|\/v1\/responses/i.test(text)) return "responses";
  if (/tool\(|maxSteps|agent\.invoke|AgentExecutor/i.test(text)) return "agent";
  if (/chat\.completions|\/v1\/chat\/completions|messages\.create/i.test(text)) return "chat";
  return "unknown";
}

function mapProvider(p: string): AiProviderId {
  const x = p.toLowerCase();
  if (x === "google-gemini") return "gemini";
  if (x === "unknown-openai-compatible") return "openai-compatible";
  if (
    [
      "openai",
      "anthropic",
      "groq",
      "gemini",
      "azure-openai",
      "aws-bedrock",
      "openrouter",
      "together",
      "mistral",
      "cohere",
      "perplexity",
      "ollama",
      "deepseek",
      "xai",
      "fireworks",
      "elevenlabs",
    ].includes(x)
  ) {
    return x as AiProviderId;
  }
  return "unknown";
}

function severityFromConfidence(c: number): "high" | "medium" | "low" {
  if (c >= 0.85) return "high";
  if (c >= 0.65) return "medium";
  return "low";
}

function evidenceKindFromString(value: string, callStyle: AiCallStyle): EvidenceKind {
  if (value.startsWith("url:")) return "provider-url";
  if (value.startsWith("env:") || /_API_KEY|OLLAMA_HOST|AWS_REGION/.test(value)) return "provider-env";
  if (value.startsWith("model:") || /\b(gpt-|claude-|gemini-|llama-|mistral)/i.test(value)) return "model-name";
  if (value.includes("endpoint")) return "http-ai-endpoint";
  if (value.includes("spawn") || value.includes("exec") || value.includes("execa") || value === "$") return "process-launcher";
  if (value.includes("script:")) return "package-script-resolution";
  if (value.includes("shell-script:")) return "shell-script-resolution";
  if (callStyle === "cli") return value.startsWith("-") || value === "exec" || value === "run" ? "ai-cli-flag" : "ai-cli-command";
  if (callStyle === "framework") return "ai-framework-call";
  if (callStyle === "custom-wrapper") return "custom-wrapper-name";
  if (callStyle === "acp") return "acp-protocol";
  if (callStyle === "http") return "provider-url";
  return "provider-method-call";
}

function buildEvidence(values: string[], line: number, confidence: number, callStyle: AiCallStyle): DetectionEvidence[] {
  return [...new Set(values.filter(Boolean))].map((value) => ({
    kind: evidenceKindFromString(value, callStyle),
    value,
    line,
    confidence,
  }));
}

function readPackageScripts(manifestAbsPaths: string[]): Map<string, string> {
  const scripts = new Map<string, string>();
  for (const manifest of manifestAbsPaths) {
    try {
      const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { scripts?: Record<string, unknown> };
      for (const [name, command] of Object.entries(parsed.scripts ?? {})) {
        if (typeof command === "string" && !scripts.has(name)) scripts.set(name, command);
      }
    } catch {
      /* ignore malformed package files */
    }
  }
  return scripts;
}

function isInsideRoot(root: string, absPath: string): boolean {
  const rel = relative(root, absPath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function stringConsts(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.set(m[1]!, m[2]!);
  return out;
}

function arrayConsts(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const vals = [...m[2]!.matchAll(/["']([^"']+)["']/g)].map((x) => x[1]!).filter(Boolean);
    out.set(m[1]!, vals);
  }
  return out;
}

function quotedArgs(raw: string): string[] {
  return [...raw.matchAll(/["']([^"']+)["']/g)].map((x) => x[1]!).filter(Boolean);
}

function dedupeFindings(rows: AiUsageFinding[]): AiUsageFinding[] {
  const m = new Map<string, AiUsageFinding>();
  for (const f of rows) {
    const k = [
      f.relativePath,
      f.line,
      f.provider,
      f.callStyle,
      f.framework ?? "",
      f.methodName ?? "",
      f.command ?? "",
      f.usageType,
    ].join("|");
    const prev = m.get(k);
    if (!prev || f.confidence > prev.confidence) m.set(k, f);
  }
  return [...m.values()];
}

export function scanAiUsage(
  projectRoot: string,
  files: ScannableFile[],
  ctx: { primaryEntry: string; manifestAbsPaths: string[] },
): AiUsageFinding[] {
  const findings: AiUsageFinding[] = [];
  const packageScripts = readPackageScripts(ctx.manifestAbsPaths);

  for (const sf of files) {
    let text: string;
    try {
      text = readFileSync(sf.path, "utf8");
    } catch {
      continue;
    }
    const rel = sf.relativePath;
    const lang = sf.language ?? "unknown";
    const constStrings = isJsTsFamilyPath(rel) ? stringConsts(text) : new Map<string, string>();
    const constArrays = isJsTsFamilyPath(rel) ? arrayConsts(text) : new Map<string, string[]>();

    const push = (
      partial: Omit<AiUsageFinding, "id" | "recommendation" | "snippet" | "filePath" | "relativePath" | "language" | "line" | "evidence"> & {
        index: number;
        snippet?: string;
        evidence?: DetectionEvidence[];
      },
    ) => {
      const line = lineOf(text, partial.index);
      const id = `${rel}:${line}:${partial.provider}:${partial.framework ?? ""}:${partial.methodName ?? ""}:${partial.command ?? ""}:${partial.callStyle}`;
      if (findings.some((f) => f.id === id)) return;
      const snip = partial.snippet ?? snippetAt(text, partial.index);
      const pkgDir = nearestPackageDirForFile(sf.path, projectRoot, ctx.manifestAbsPaths);
      const rec = buildSpectyraFindingRecommendation({
        provider: partial.provider,
        usageType: partial.usageType,
        callStyle: partial.callStyle,
        primaryEntry: ctx.primaryEntry,
        packageDir: pkgDir,
      });
      rec.confidence = partial.confidence;
      findings.push({
        ...partial,
        id,
        line,
        filePath: sf.path,
        relativePath: rel,
        language: lang,
        evidence: partial.evidence ?? buildEvidence(partial.providerEvidence, line, partial.confidence, partial.callStyle),
        snippet: snip,
        recommendation: rec,
        packageDir: pkgDir,
      });
    };

    if (isJsTsFamilyPath(rel)) {
      for (const h of scanJsTsAstSource(text)) {
        push({
          index: h.index,
          provider: h.provider,
          providerEvidence: h.providerEvidence,
          usageType: h.usageType,
          callStyle: h.callStyle,
          methodName: h.methodName,
          framework: h.framework,
          command: h.command,
          commandArgs: h.commandArgs,
          isCliHarness: h.isCliHarness,
          cliTool: h.cliTool,
          modelHints: h.modelHints,
          envHints: h.envHints,
          urlHints: h.urlHints,
          isStreaming: h.isStreaming,
          confidence: h.confidence,
          severity: severityFromConfidence(h.confidence),
        });
      }
    }

    for (const h of detectCliHarnessInText({ text, relativePath: rel, language: lang })) {
      push({
        index: h.index,
        snippet: h.snippet,
        provider: h.provider,
        providerEvidence: h.providerEvidence,
        usageType: h.usageType,
        callStyle: h.callStyle,
        methodName: h.methodName,
        framework: h.framework,
        command: h.command,
        commandArgs: h.commandArgs,
        isCliHarness: h.isCliHarness,
        cliTool: h.cliTool,
        modelHints: h.modelHints,
        envHints: h.envHints,
        urlHints: h.urlHints,
        isStreaming: h.isStreaming,
        confidence: h.confidence,
        severity: severityFromConfidence(h.confidence),
      });
    }

    if (isJsTsFamilyPath(rel)) {
      const resolvedConstCall = /\b(spawn|execFile|execa)\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)/g;
      let cm: RegExpExecArray | null;
      while ((cm = resolvedConstCall.exec(text))) {
        const launcher = cm[1]!;
        const command = constStrings.get(cm[2]!);
        const args = constArrays.get(cm[3]!) ?? [];
        const callLine = lineOf(text, cm.index);
        if (!command) continue;
        const detection = detectCliHarnessCommand(`${command} ${args.join(" ")}`, { relativePath: rel, language: "shell" });
        if (!detection) continue;
        push({
          index: cm.index,
          provider: detection.provider,
          providerEvidence: [launcher, detection.command, ...detection.evidence],
          evidence: [
            { kind: "process-launcher", value: launcher, line: callLine, confidence: 0.9 },
            { kind: "ai-cli-command", value: detection.command, line: callLine, confidence: 0.9 },
            ...detection.commandArgs.map((value) => ({ kind: "ai-cli-flag" as const, value, line: callLine, confidence: 0.85 })),
          ],
          usageType: "agent",
          callStyle: "cli",
          methodName: launcher,
          framework: detection.framework,
          command: detection.command,
          commandArgs: detection.commandArgs,
          isCliHarness: true,
          cliTool: detection.tool,
          cliRunMode: detection.cliRunMode ?? "one-shot",
          modelHints: [],
          envHints: [],
          urlHints: [],
          isStreaming: detection.isStreaming,
          confidence: Math.max(0.88, detection.confidence),
          severity: "high",
        });
      }

      const npmScriptCall = /\b(spawn|execFile|execa)\s*\(\s*["'](?:npm|pnpm|yarn|bun)["']\s*,\s*\[([^\]]+)\]/g;
      while ((cm = npmScriptCall.exec(text))) {
        const args = quotedArgs(cm[2]!);
        const runIdx = args.findIndex((x) => x === "run" || x === "run-script");
        const scriptName = runIdx >= 0 ? args[runIdx + 1] : undefined;
        const scriptCommand = scriptName ? packageScripts.get(scriptName) : undefined;
        if (!scriptName || !scriptCommand) continue;
        const detection = detectCliHarnessCommand(scriptCommand, { relativePath: "package.json", language: "json" });
        if (!detection) continue;
        push({
          index: cm.index,
          provider: detection.provider,
          providerEvidence: [cm[1]!, `script:${scriptName}`, ...detection.evidence],
          evidence: [
            { kind: "process-launcher", value: cm[1]!, line: lineOf(text, cm.index), confidence: 0.9 },
            { kind: "package-script-resolution", value: `${scriptName}: ${scriptCommand}`, line: lineOf(text, cm.index), confidence: 0.9 },
            { kind: "ai-cli-command", value: detection.command, line: lineOf(text, cm.index), confidence: 0.9 },
          ],
          usageType: "agent",
          callStyle: "cli",
          methodName: `${cm[1]} npm-run`,
          framework: detection.framework,
          command: detection.command,
          commandArgs: detection.commandArgs,
          isCliHarness: true,
          cliTool: detection.tool,
          cliRunMode: "one-shot",
          modelHints: [],
          envHints: [],
          urlHints: [],
          isStreaming: detection.isStreaming,
          confidence: 0.9,
          severity: "high",
        });
      }

      const shellScriptCall = /\b(spawn|execFile|execa)\s*\(\s*["'](?:bash|sh|zsh)["']\s*,\s*\[\s*["']([^"']+)["']/g;
      while ((cm = shellScriptCall.exec(text))) {
        const scriptRel = cm[2]!;
        const scriptAbs = resolve(projectRoot, scriptRel);
        if (!isInsideRoot(resolve(projectRoot), scriptAbs) || !existsSync(scriptAbs)) continue;
        let scriptText = "";
        try {
          scriptText = readFileSync(scriptAbs, "utf8");
        } catch {
          continue;
        }
        const scriptHits = detectCliHarnessInText({ text: scriptText, relativePath: scriptRel, language: "shell" });
        const h = scriptHits[0];
        if (!h) continue;
        push({
          index: cm.index,
          provider: h.provider,
          providerEvidence: [cm[1]!, `shell-script:${scriptRel}`, ...h.providerEvidence],
          evidence: [
            { kind: "process-launcher", value: cm[1]!, line: lineOf(text, cm.index), confidence: 0.88 },
            { kind: "shell-script-resolution", value: scriptRel, line: lineOf(text, cm.index), confidence: 0.88 },
            { kind: "ai-cli-command", value: h.command ?? "ai-cli", line: lineOf(text, cm.index), confidence: 0.88 },
          ],
          usageType: "agent",
          callStyle: "cli",
          methodName: `${cm[1]} shell-script`,
          framework: h.framework,
          command: h.command,
          commandArgs: h.commandArgs,
          isCliHarness: true,
          cliTool: h.cliTool,
          cliRunMode: h.cliRunMode ?? "one-shot",
          modelHints: h.modelHints,
          envHints: h.envHints,
          urlHints: [],
          isStreaming: h.isStreaming,
          confidence: 0.88,
          severity: "high",
        });
      }

      const persistentRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(spawn|execa)\s*\(\s*["']([^"']+)["'][\s\S]{0,900}?\1\.stdin(?:\??\.)?\.write\s*\([\s\S]{0,900}?\1\.stdout\.on\s*\(\s*["']data["']/g;
      while ((cm = persistentRe.exec(text))) {
        const detection = detectCliHarnessCommand(`${cm[3]} stdin stdout`, { relativePath: rel, language: "shell" });
        if (!detection) continue;
        push({
          index: cm.index,
          provider: detection.provider,
          providerEvidence: [cm[2]!, detection.command, "stdin.write", "stdout.on(data)"],
          evidence: [
            { kind: "process-launcher", value: cm[2]!, line: lineOf(text, cm.index), confidence: 0.93 },
            { kind: "ai-cli-command", value: detection.command, line: lineOf(text, cm.index), confidence: 0.93 },
            { kind: "stdin-session", value: "stdin.write", line: lineOf(text, cm.index), confidence: 0.93 },
            { kind: "stdout-stream", value: "stdout.on(data)", line: lineOf(text, cm.index), confidence: 0.93 },
          ],
          usageType: "agent",
          callStyle: "cli",
          methodName: `${cm[2]} persistent-session`,
          framework: detection.framework.replace("-harness", "-session-harness"),
          command: detection.command,
          commandArgs: [],
          isCliHarness: true,
          cliTool: detection.tool,
          cliRunMode: "persistent-session",
          usesStdin: true,
          writesToStdin: true,
          readsStdoutStream: true,
          modelHints: [],
          envHints: [],
          urlHints: [],
          isStreaming: true,
          confidence: 0.93,
          severity: "high",
        });
      }
    }

    const sdkRules: Array<{
      re: RegExp;
      provider: AiProviderId;
      callStyle: AiCallStyle;
      usageType: AiUsageType;
      evidence: string;
    }> = [
      { re: /\bfrom\s+["']openai["']|require\(\s*["']openai["']|\bnew\s+OpenAI\s*\(/, provider: "openai", callStyle: "sdk", usageType: "chat", evidence: "openai sdk" },
      { re: /\bopenai\.beta\.(threads|assistants|messages|runs)\b/, provider: "openai", callStyle: "sdk", usageType: "agent", evidence: "openai assistants beta" },
      {
        re: /\bfrom\s+["']@anthropic-ai\/sdk["']|\bnew\s+Anthropic\s*\(/,
        provider: "anthropic",
        callStyle: "sdk",
        usageType: "chat",
        evidence: "anthropic sdk",
      },
      { re: /\bfrom\s+["']groq-sdk["']|\bnew\s+Groq\s*\(/, provider: "groq", callStyle: "sdk", usageType: "chat", evidence: "groq sdk" },
      {
        re: /\bfrom\s+["']@google\/generative-ai["']|\bGoogleGenerativeAI\b|\bfrom\s+["']@google\/genai["']/,
        provider: "gemini",
        callStyle: "sdk",
        usageType: "chat",
        evidence: "google genai sdk",
      },
      { re: /\bfrom\s+["']@azure\/openai["']|\bAzureOpenAI\b/, provider: "azure-openai", callStyle: "sdk", usageType: "chat", evidence: "azure openai" },
      {
        re: /@aws-sdk\/client-bedrock-runtime|InvokeModelCommand|InvokeModelWithResponseStreamCommand/,
        provider: "aws-bedrock",
        callStyle: "sdk",
        usageType: "chat",
        evidence: "bedrock sdk",
      },
      { re: /\bfrom\s+["']@mistralai\/mistralai["']|\bnew\s+Mistral\s*\(/, provider: "mistral", callStyle: "sdk", usageType: "chat", evidence: "mistral sdk" },
      { re: /\bfrom\s+["']cohere-ai["']|\bfrom\s+["']@cohere-ai\/cohere-client["']|\bnew\s+CohereClient\s*\(/, provider: "cohere", callStyle: "sdk", usageType: "chat", evidence: "cohere sdk" },
      { re: /\bfrom\s+["']@huggingface\/inference["']|\bHfInferenceEndpoint\b/, provider: "huggingface", callStyle: "sdk", usageType: "chat", evidence: "huggingface inference" },
      { re: /\bfrom\s+["']replicate["']|\bnew\s+Replicate\s*\(/, provider: "replicate", callStyle: "sdk", usageType: "chat", evidence: "replicate sdk" },
      { re: /\bfrom\s+["']ollama["']|\bnew\s+Ollama\s*\(/, provider: "ollama", callStyle: "sdk", usageType: "chat", evidence: "ollama sdk" },
      { re: /\bfrom\s+["']@ai-sdk\/openai["']|\bcreateOpenAI\s*\(/, provider: "openai", callStyle: "framework", usageType: "chat", evidence: "@ai-sdk/openai" },
      { re: /\bfrom\s+["']@ai-sdk\/anthropic["']|\bcreateAnthropic\s*\(/, provider: "anthropic", callStyle: "framework", usageType: "chat", evidence: "@ai-sdk/anthropic" },
      {
        re: /\bfrom\s+["']@ai-sdk\/google["']|\bfrom\s+["']@ai-sdk\/google-vertex["']|\bcreateGoogleGenerativeAI\s*\(/,
        provider: "gemini",
        callStyle: "framework",
        usageType: "chat",
        evidence: "@ai-sdk/google",
      },
      { re: /\bfrom\s+["']@ai-sdk\/groq["']|\bcreateGroq\s*\(/, provider: "groq", callStyle: "framework", usageType: "chat", evidence: "@ai-sdk/groq" },
      { re: /\bfrom\s+["']@ai-sdk\/mistral["']|\bcreateMistral\s*\(/, provider: "mistral", callStyle: "framework", usageType: "chat", evidence: "@ai-sdk/mistral" },
      { re: /\bfrom\s+["']ai["']|streamText\s*\(|generateText\s*\(|generateObject\s*\(/, provider: "vercel-ai-sdk", callStyle: "framework", usageType: "chat", evidence: "vercel ai sdk" },
      { re: /@langchain\/|langchain|ChatOpenAI|ChatAnthropic|ChatGroq|from\s+["']langchain/, provider: "langchain", callStyle: "framework", usageType: "agent", evidence: "langchain" },
      { re: /@langchain\/langgraph|StateGraph\s*\(/, provider: "langchain", callStyle: "framework", usageType: "agent", evidence: "langgraph" },
      { re: /llamaindex|llama_index|VectorStoreIndex|OpenAIEmbedding/, provider: "llamaindex", callStyle: "framework", usageType: "chat", evidence: "llamaindex" },
      { re: /\blitellm\b|litellm\.(completion|acompletion|embedding)/, provider: "litellm", callStyle: "sdk", usageType: "chat", evidence: "litellm" },
    ];

    for (const rule of sdkRules) {
      const m = rule.re.exec(text);
      if (!m) continue;
      const modelHints = extractModelLiteralsFromText(text).slice(0, 6);
      const envHints = [...text.matchAll(ENV_NAMES)].map((x) => x[1]!).filter(Boolean).slice(0, 8);
      push({
        index: m.index,
        provider: rule.provider,
        providerEvidence: [rule.evidence],
        usageType: inferUsageType(text.slice(Math.max(0, m.index - 200), m.index + 200)) ?? rule.usageType,
        callStyle: rule.callStyle,
        methodName: m[0]?.slice(0, 80),
        modelHints,
        envHints,
        urlHints: [],
        confidence: 0.88,
        severity: severityFromConfidence(0.88),
      });
    }

    if (isJsTsFamilyPath(rel)) {
      const methodLineRules: Array<{
        re: RegExp;
        provider: AiProviderId;
        usageType: AiUsageType;
        callStyle: AiCallStyle;
        evidence: string;
        confidence: number;
      }> = [
        { re: /\.chat\.completions\.(create|parse|stream)\s*\(/g, provider: "openai", usageType: "chat", callStyle: "sdk", evidence: "openai.chat.completions", confidence: 0.92 },
        { re: /\.responses\.(create|stream)\s*\(/g, provider: "openai", usageType: "responses", callStyle: "sdk", evidence: "openai.responses", confidence: 0.92 },
        { re: /\.embeddings\.create\s*\(/g, provider: "openai", usageType: "embedding", callStyle: "sdk", evidence: "openai.embeddings", confidence: 0.9 },
        { re: /\.messages\.(create|stream)\s*\(/g, provider: "anthropic", usageType: "chat", callStyle: "sdk", evidence: "anthropic.messages", confidence: 0.92 },
        { re: /\.beta\.messages\.create\s*\(/g, provider: "anthropic", usageType: "chat", callStyle: "sdk", evidence: "anthropic.beta.messages", confidence: 0.9 },
        { re: /\.generateContent(Stream)?\s*\(/g, provider: "gemini", usageType: "chat", callStyle: "sdk", evidence: "gemini.generateContent", confidence: 0.9 },
        { re: /\.models\.generateContent(Stream)?\s*\(/g, provider: "gemini", usageType: "chat", callStyle: "sdk", evidence: "gemini.models.generateContent", confidence: 0.9 },
        { re: /\bstreamText\s*\(|\bgenerateText\s*\(|\bgenerateObject\s*\(|\bstreamObject\s*\(|\bembed(Many)?\s*\(/g, provider: "vercel-ai-sdk", usageType: "chat", callStyle: "framework", evidence: "vercel-ai-sdk-fn", confidence: 0.86 },
      ];
      for (const rule of methodLineRules) {
        rule.re.lastIndex = 0;
        let mm: RegExpExecArray | null;
        while ((mm = rule.re.exec(text)) !== null) {
          push({
            index: mm.index,
            provider: rule.provider,
            providerEvidence: [rule.evidence],
            usageType: inferUsageType(text.slice(Math.max(0, mm.index - 120), mm.index + 120)) ?? rule.usageType,
            callStyle: rule.callStyle,
            methodName: mm[0]?.slice(0, 80),
            modelHints: extractModelLiteralsFromText(text).slice(0, 6),
            envHints: [...text.matchAll(ENV_NAMES)].map((x) => x[1]!).filter(Boolean).slice(0, 8),
            urlHints: [],
            confidence: rule.confidence,
            severity: severityFromConfidence(rule.confidence),
          });
        }
      }
    }

    if (lang === "python" || /\.py$/i.test(rel)) {
      for (const rule of PYTHON_SDK_RULES) {
        const m = rule.re.exec(text);
        if (!m) continue;
        const modelHints = extractModelLiteralsFromText(text).slice(0, 6);
        const envHints = [...text.matchAll(ENV_NAMES)].map((x) => x[1]!).filter(Boolean).slice(0, 8);
        push({
          index: m.index,
          provider: rule.provider,
          providerEvidence: [rule.evidence],
          usageType: inferUsageType(text.slice(Math.max(0, m.index - 200), m.index + 200)) ?? rule.usageType,
          callStyle: rule.callStyle,
          methodName: m[0]?.slice(0, 80),
          modelHints,
          envHints,
          urlHints: [],
          confidence: 0.86,
          severity: severityFromConfidence(0.86),
        });
      }
    }

    const httpRe =
      /\bfetch\s*\(|axios\.(post|get|request)\s*\(|got\.(post|get)\s*\(|ky\.(post|get)\s*\(|https?\.request\s*\(|\$fetch\s*\(|ofetch\s*\(|undici\.fetch\s*\(/gi;
    httpRe.lastIndex = 0;
    let hm: RegExpExecArray | null;
    while ((hm = httpRe.exec(text)) !== null) {
      const win = callWindow(text, hm.index);
      let provider: AiProviderId = "unknown";
      const ev: string[] = [];
      for (const [pid, rx] of PROVIDER_URL) {
        if (rx.test(win)) {
          provider = mapProvider(pid);
          ev.push(`url:${pid}`);
        }
      }
      if (AI_PATH.test(win)) ev.push("ai-endpoint-path");
      const envHints = [...win.matchAll(ENV_NAMES)].map((x) => x[1]!).filter(Boolean);
      envHints.forEach((e) => ev.push(`env:${e}`));
      const modelHints = extractModelLiteralsFromText(win);
      if (MODEL_TOKEN.test(win)) {
        const mm = win.match(MODEL_TOKEN);
        if (mm?.[0]) modelHints.push(mm[0]);
      }
      const score =
        (provider !== "unknown" ? 0.45 : 0) +
        (AI_PATH.test(win) ? 0.25 : 0) +
        Math.min(0.3, envHints.length * 0.08) +
        Math.min(0.2, modelHints.length * 0.05);
      if (score < 0.55) continue;
      push({
        index: hm.index,
        provider: provider !== "unknown" ? provider : "openai-compatible",
        providerEvidence: ev.length ? ev : ["http-client+context"],
        usageType: inferUsageType(win),
        callStyle: "http",
        modelHints: [...new Set(modelHints)].slice(0, 8),
        envHints,
        urlHints: [],
        confidence: Math.min(0.95, 0.55 + score * 0.4),
        severity: score > 0.85 ? "high" : "medium",
      });
    }

    if (lang === "python" || /\.py$/i.test(rel)) {
      const pyHttp =
        /\b(httpx\.(get|post|patch|put|delete|request)\s*\(|httpx\.AsyncClient|requests\.(get|post|patch|put|delete|request)\s*\(|session\.(get|post)\s*\()/gi;
      pyHttp.lastIndex = 0;
      while ((hm = pyHttp.exec(text)) !== null) {
        const win = callWindow(text, hm.index);
        let provider: AiProviderId = "unknown";
        const ev: string[] = [];
        for (const [pid, rx] of PROVIDER_URL) {
          if (rx.test(win)) {
            provider = mapProvider(pid);
            ev.push(`url:${pid}`);
          }
        }
        if (AI_PATH.test(win)) ev.push("ai-endpoint-path");
        const envHints = [...win.matchAll(ENV_NAMES)].map((x) => x[1]!).filter(Boolean);
        envHints.forEach((e) => ev.push(`env:${e}`));
        const modelHints = extractModelLiteralsFromText(win);
        if (MODEL_TOKEN.test(win)) {
          const mm = win.match(MODEL_TOKEN);
          if (mm?.[0]) modelHints.push(mm[0]);
        }
        const score =
          (provider !== "unknown" ? 0.45 : 0) +
          (AI_PATH.test(win) ? 0.25 : 0) +
          Math.min(0.3, envHints.length * 0.08) +
          Math.min(0.2, modelHints.length * 0.05);
        if (score < 0.55) continue;
        push({
          index: hm.index,
          provider: provider !== "unknown" ? provider : "openai-compatible",
          providerEvidence: ev.length ? ev : ["python-http+context"],
          usageType: inferUsageType(win),
          callStyle: "http",
          modelHints: [...new Set(modelHints)].slice(0, 8),
          envHints,
          urlHints: [],
          confidence: Math.min(0.95, 0.55 + score * 0.4),
          severity: score > 0.85 ? "high" : "medium",
        });
      }
    }

    const wm = WRAPPER_FN.exec(text);
    if (wm && (MODEL_TOKEN.test(text) || ENV_NAMES_TEST.test(text) || PROVIDER_URL.some(([, rx]) => rx.test(text)))) {
      push({
        index: wm.index,
        provider: "custom-gateway",
        providerEvidence: ["named-wrapper-fn+model-or-env"],
        usageType: inferUsageType(text.slice(wm.index, wm.index + 400)),
        callStyle: "custom-wrapper",
        methodName: wm[1],
        modelHints: extractModelLiteralsFromText(text).slice(0, 6),
        envHints: [...text.matchAll(ENV_NAMES)].map((x) => x[1]!).slice(0, 8),
        urlHints: [],
        confidence: 0.72,
        severity: "medium",
      });
    }

    const acp = ACP_RE.exec(text);
    if (acp && ACP_METHOD_RE.test(text)) {
      const idx = acp.index;
      const line = lineOf(text, idx);
      push({
        index: idx,
        provider: "unknown",
        providerEvidence: [acp[0]!, "agent/session protocol"],
        evidence: [
          { kind: "acp-protocol", value: acp[0]!, line, confidence: 0.9 },
          { kind: "acp-protocol", value: text.match(ACP_METHOD_RE)?.[0] ?? "session/prompt", line, confidence: 0.9 },
        ],
        usageType: "agent",
        callStyle: "acp",
        methodName: text.match(ACP_METHOD_RE)?.[0] ?? "acp",
        framework: "acp-harness",
        isAcpHarness: true,
        modelHints: extractModelLiteralsFromText(text).slice(0, 6),
        envHints: [...text.matchAll(ENV_NAMES)].map((x) => x[1]!).slice(0, 8),
        urlHints: [],
        confidence: 0.9,
        severity: "high",
      });
    } else if (acp) {
      push({
        index: acp.index,
        provider: "unknown",
        providerEvidence: [acp[0]!],
        evidence: [{ kind: "acp-protocol", value: acp[0]!, line: lineOf(text, acp.index), confidence: 0.45 }],
        usageType: "agent",
        callStyle: "acp",
        methodName: "possible-acp-reference",
        framework: "acp-harness",
        isAcpHarness: true,
        modelHints: [],
        envHints: [],
        urlHints: [],
        confidence: 0.45,
        severity: "low",
      });
    }
  }

  for (const f of findings) {
    for (const mh of f.modelHints) {
      const c = classifyModelHint(mh);
      f.recommendation.notes.push(...c.spectyraStrategyHints.map((h) => `Model hint (${mh}): ${h}`));
    }
  }

  void projectRoot;
  return dedupeFindings(findings).sort((a, b) => b.confidence - a.confidence);
}

export function findingsToAiCallSites(findings: AiUsageFinding[]): AiCallSite[] {
  return findings.map((f) => ({
    file: f.relativePath,
    line: f.line,
    kind: f.callStyle === "http" ? "fetch" : f.callStyle === "sdk" ? "openai-sdk" : "unknown",
    provider: f.provider,
    modelHint: f.modelHints[0],
    urlHint: f.urlHints[0],
    envVars: f.envHints,
    confidence: f.confidence >= 0.8 ? "high" : f.confidence >= 0.6 ? "medium" : "low",
    snippet: f.snippet,
  }));
}
