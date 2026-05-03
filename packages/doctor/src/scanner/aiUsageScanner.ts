import { readFileSync } from "node:fs";
import type {
  AiCallStyle,
  AiProviderId,
  AiUsageFinding,
  AiUsageType,
  AiCallSite,
  ScannableFile,
  SpectyraRecommendation,
} from "./types.js";
import { classifyModelHint, extractModelLiteralsFromText } from "./modelClassifier.js";
import { nearestPackageDirForFile } from "./monorepo.js";

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

function defaultRecommendation(args: {
  provider: AiProviderId;
  usageType: AiUsageType;
  callStyle: AiCallStyle;
  primaryEntry: string;
  packageDir?: string;
}): SpectyraRecommendation {
  const notes: string[] = [
    "Prefer `import \"@spectyra/sdk/auto\"` at your Node server entry for automatic metadata capture where supported.",
    "For full optimization (token routing, reports), use `createSpectyra` with the appropriate provider adapter from `@spectyra/sdk`.",
  ];
  if (args.usageType === "streaming") {
    notes.push("Streaming: use `createSpectyra().complete(...)` where you can swap to Spectyra-managed calls, or rely on `@spectyra/sdk/auto` for HTTP-level capture.");
  }
  const suggestedCode =
    args.callStyle === "sdk" && (args.provider === "openai" || args.provider === "groq" || args.provider === "anthropic")
      ? `import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const spectyra = createSpectyra({ runMode: "on", licenseKey: process.env.SPECTYRA_LICENSE_KEY });
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { providerResult, report } = await spectyra.complete(
  { provider: "openai", client, model: "gpt-4o-mini", messages },
  createOpenAIAdapter(),
);
// Use providerResult like the raw SDK response; inspect report for savings.`
      : `import "@spectyra/sdk/auto";

// Add at the very top of ${args.primaryEntry}`;

  return {
    priority: "high",
    title: `Instrument ${args.provider} usage`,
    summary: `Detected ${args.callStyle} ${args.usageType} usage for ${args.provider}.`,
    installPackage: "@spectyra/sdk",
    setupLocation: args.primaryEntry,
    wrapperLocation: args.callStyle === "custom-wrapper" ? args.packageDir : args.packageDir,
    suggestedImport: `import "@spectyra/sdk/auto";`,
    suggestedCode,
    notes,
    estimatedEffort: "15 minutes",
    confidence: 0.75,
  };
}

export function scanAiUsage(
  projectRoot: string,
  files: ScannableFile[],
  ctx: { primaryEntry: string; manifestAbsPaths: string[] },
): AiUsageFinding[] {
  const findings: AiUsageFinding[] = [];

  for (const sf of files) {
    let text: string;
    try {
      text = readFileSync(sf.path, "utf8");
    } catch {
      continue;
    }
    const rel = sf.relativePath;
    const lang = sf.language ?? "unknown";

    const push = (
      partial: Omit<AiUsageFinding, "id" | "recommendation" | "snippet" | "filePath" | "relativePath" | "language" | "line"> & {
        index: number;
        snippet?: string;
      },
    ) => {
      const line = lineOf(text, partial.index);
      const id = `${rel}:${line}:${partial.provider}:${partial.usageType}`;
      if (findings.some((f) => f.id === id)) return;
      const snip = partial.snippet ?? snippetAt(text, partial.index);
      const rec = defaultRecommendation({
        provider: partial.provider,
        usageType: partial.usageType,
        callStyle: partial.callStyle,
        primaryEntry: ctx.primaryEntry,
        packageDir: nearestPackageDirForFile(sf.path, projectRoot, ctx.manifestAbsPaths),
      });
      rec.confidence = partial.confidence;
      findings.push({
        ...partial,
        id,
        line,
        filePath: sf.path,
        relativePath: rel,
        language: lang,
        snippet: snip,
        recommendation: rec,
        packageDir: nearestPackageDirForFile(sf.path, projectRoot, ctx.manifestAbsPaths),
      });
    };

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
        severity: "high",
      });
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
          severity: "high",
        });
      }
    }

    const httpRe =
      /\bfetch\s*\(|axios\.(post|get|request)\s*\(|got\.(post|get)\s*\(|ky\.(post|get)\s*\(|https?\.request\s*\(|\$fetch\s*\(|ofetch\s*\(|undici\.fetch\s*\(/gi;
    httpRe.lastIndex = 0;
    let hm: RegExpExecArray | null;
    while ((hm = httpRe.exec(text)) !== null) {
      const ln = lineOf(text, hm.index);
      const win = windowAroundLine(text, ln);
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
        const ln = lineOf(text, hm.index);
        const win = windowAroundLine(text, ln);
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
  }

  for (const f of findings) {
    for (const mh of f.modelHints) {
      const c = classifyModelHint(mh);
      f.recommendation.notes.push(...c.spectyraStrategyHints.map((h) => `Model hint (${mh}): ${h}`));
    }
  }

  void projectRoot;
  return findings.sort((a, b) => b.confidence - a.confidence);
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
