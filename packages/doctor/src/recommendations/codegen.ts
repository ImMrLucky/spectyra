import type { AiProviderId, AiUsageFinding, DoctorCodeBlock, IntegrationPoint } from "../scanner/types.js";
import {
  buildCliHarnessIntegrationBlocks,
  replacementCode as cliReplacementCode,
  suggestedCliWrapperFile,
} from "./cliHarnessCodegen.js";

function firstModel(f: AiUsageFinding, fallback: string): string {
  return f.modelHints?.[0] ?? fallback;
}

function envForProvider(provider: AiProviderId): string {
  switch (provider) {
    case "openai":
    case "azure-openai":
    case "openai-compatible":
      return "OPENAI_API_KEY";
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "groq":
      return "GROQ_API_KEY";
    case "openrouter":
      return "OPENROUTER_API_KEY";
    case "together":
      return "TOGETHER_API_KEY";
    case "perplexity":
      return "PERPLEXITY_API_KEY";
    case "mistral":
      return "MISTRAL_API_KEY";
    case "cohere":
      return "COHERE_API_KEY";
    default:
      return "PROVIDER_API_KEY";
  }
}

function openAiBaseUrl(provider: AiProviderId): string | undefined {
  switch (provider) {
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "together":
      return "https://api.together.xyz/v1";
    case "perplexity":
      return "https://api.perplexity.ai";
    default:
      return undefined;
  }
}

function providerLiteral(provider: AiProviderId): string {
  if (provider === "openrouter" || provider === "together" || provider === "perplexity") return provider;
  if (provider === "openai-compatible") return "openai";
  if (provider === "azure-openai") return "openai";
  return provider;
}

function importPathForWrapper(wrapperFile: string, finding: AiUsageFinding): string {
  const wrapperName = wrapperFile.split("/").pop()?.replace(/\.[cm]?[tj]sx?$/, "") ?? "llm";
  if (finding.provider === "anthropic") return `./lib/ai/${wrapperName}`;
  if (finding.provider === "groq") return `./lib/ai/${wrapperName}`;
  return `./lib/ai/${wrapperName}`;
}

export function languageForFinding(f: AiUsageFinding): DoctorCodeBlock["language"] {
  if (f.language === "python" || f.relativePath.endsWith(".py")) return "py";
  if (f.relativePath.endsWith(".tsx")) return "tsx";
  if (f.relativePath.endsWith(".jsx")) return "jsx";
  if (f.relativePath.endsWith(".js") || f.relativePath.endsWith(".mjs") || f.relativePath.endsWith(".cjs")) return "js";
  return "ts";
}

export function suggestedWrapperFile(f: AiUsageFinding, points: IntegrationPoint[] = []): string {
  if (f.callStyle === "cli" || f.isCliHarness) {
    return suggestedCliWrapperFile(f, points);
  }

  const existingWrapper = points.find((p) => {
    if (p.type !== "llm-wrapper" && p.type !== "provider-client") return false;
    if (!f.packageDir || f.packageDir === ".") return true;
    return p.relativePath === f.packageDir || p.relativePath.startsWith(`${f.packageDir}/`);
  });

  if (existingWrapper) return existingWrapper.relativePath;

  const base = f.packageDir && f.packageDir !== "." ? `${f.packageDir}/src/lib/ai` : "src/lib/ai";

  if (f.provider === "anthropic") return `${base}/anthropic.ts`;
  if (f.provider === "groq") return `${base}/groq.ts`;
  if (f.provider === "gemini") return `${base}/gemini.ts`;
  return `${base}/llm.ts`;
}

export function replacementSnippetForFinding(
  f: AiUsageFinding,
  points: IntegrationPoint[] = [],
): DoctorCodeBlock | undefined {
  if (f.language === "python" || f.relativePath.endsWith(".py")) return undefined;
  if (f.callStyle === "cli" || f.isCliHarness) {
    return {
      title: `Update ${f.relativePath}:${f.line}`,
      language: languageForFinding(f),
      copyLabel: "Copy CLI call replacement",
      code: cliReplacementCode(f, suggestedCliWrapperFile(f, points)),
    };
  }
  const wrapperFile = suggestedWrapperFile(f, points);
  if (f.provider === "anthropic") {
    return {
      title: `Update ${f.relativePath}:${f.line}`,
      language: languageForFinding(f),
      copyLabel: "Copy call-site replacement",
      code: `// Replace the direct provider call at ${f.relativePath}:${f.line}
import { messageWithSpectyra } from "${importPathForWrapper(wrapperFile, f)}";

const response = await messageWithSpectyra(messages);
`,
    };
  }
  return {
    title: `Update ${f.relativePath}:${f.line}`,
    language: languageForFinding(f),
    copyLabel: "Copy call-site replacement",
    code: `// Replace the direct provider call at ${f.relativePath}:${f.line}
import { chatWithSpectyra } from "${importPathForWrapper(wrapperFile, f)}";

const completion = await chatWithSpectyra(messages);
`,
  };
}

export function buildWrapperCodeForFinding(
  f: AiUsageFinding,
  points: IntegrationPoint[] = [],
): DoctorCodeBlock[] {
  if (f.language === "python" || f.relativePath.endsWith(".py")) return pythonReviewBlocks(f);
  if (f.callStyle === "cli" || f.isCliHarness) return buildCliHarnessIntegrationBlocks(f, points);

  switch (f.provider) {
    case "openai":
    case "azure-openai":
    case "openai-compatible":
    case "openrouter":
    case "together":
    case "perplexity":
      return openAiCompatibleBlocks(f, points);

    case "groq":
      return f.callStyle === "sdk" ? groqNativeBlocks(f, points) : openAiCompatibleBlocks(f, points);

    case "anthropic":
      return anthropicBlocks(f, points);

    case "vercel-ai-sdk":
      return vercelAiBlocks(f);

    case "langchain":
      return langChainBlocks(f);

    case "llamaindex":
      return llamaIndexBlocks(f);

    default:
      return genericBlocks(f);
  }
}

function cliRunnerName(f: AiUsageFinding): string {
  if (f.cliTool === "claude") return "runClaudeWithSpectyra";
  if (f.cliTool === "gemini") return "runGeminiWithSpectyra";
  if (f.cliTool === "codex") return "runCodexWithSpectyra";
  return "runAiCliWithSpectyra";
}

function cliFactoryName(f: AiUsageFinding): string {
  if (f.cliTool === "claude") return "createClaudeCliHarness";
  if (f.cliTool === "gemini") return "createGeminiCliHarness";
  if (f.cliTool === "codex") return "createCodexCliHarness";
  return "createCliHarness";
}

function cliCommand(f: AiUsageFinding): string {
  if (f.command) return f.command;
  if (f.cliTool === "claude") return "claude";
  if (f.cliTool === "gemini") return "gemini";
  if (f.cliTool === "codex") return "codex";
  return "your-ai-command";
}

function cliHarnessBlocks(f: AiUsageFinding, points: IntegrationPoint[]): DoctorCodeBlock[] {
  const wrapperFile = suggestedWrapperFile(f, points);
  const factory = cliFactoryName(f);
  const runner = cliRunnerName(f);
  const command = cliCommand(f);
  const provider = f.provider === "unknown" ? "unknown" : providerLiteral(f.provider);
  const framework = f.framework ?? "custom-ai-cli-harness";
  const importLine =
    factory === "createCliHarness"
      ? `import { createCliHarness } from "@spectyra/sdk/cli";`
      : `import { ${factory} } from "@spectyra/sdk/cli";`;
  const defaultArgs =
    f.cliTool === "claude" ? `\n  defaultArgs: ["--output-format", "${f.isStreaming ? "stream-json" : "json"}"],` : "";
  const factoryArgs =
    factory === "createCliHarness"
      ? `{
  command: "${command}",
  provider: "${provider}",
  framework: "${framework}",
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
}`
      : `{
  command: "${command}",
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,${defaultArgs}
}`;
  const replacement = replacementSnippetForFinding(f, points);

  return [
    {
      title: `Create ${wrapperFile}`,
      language: "ts",
      copyLabel: "Copy CLI harness wrapper",
      code: `${importLine}

const aiCli = ${factory}(${factoryArgs});

export async function ${runner}(prompt: string) {
  return aiCli.run({
    prompt,
    metadata: {
      provider: "${provider}",
      framework: "${framework}",
      taskType: "coding-agent",
    },
  });
}
`,
    },
    ...(f.isStreaming
      ? [
          {
            title: "Streaming CLI variant",
            language: "ts" as const,
            copyLabel: "Copy streaming variant",
            code: `const result = await aiCli.run({
  prompt,
  args: ["--output-format", "stream-json"],
  onStdout(chunk) {
    process.stdout.write(chunk);
  },
  metadata: {
    provider: "${provider}",
    framework: "${framework}",
    streaming: true,
  },
});
`,
          },
        ]
      : []),
    ...(replacement ? [replacement] : []),
  ];
}

function openAiCompatibleBlocks(f: AiUsageFinding, points: IntegrationPoint[]): DoctorCodeBlock[] {
  const wrapperFile = suggestedWrapperFile(f, points);
  const provider = providerLiteral(f.provider);
  const model = firstModel(f, provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini");
  const env = envForProvider(f.provider);
  const baseURL = openAiBaseUrl(f.provider);
  const baseUrlLine = baseURL ? `\n  baseURL: "${baseURL}",` : "";
  const replacement = replacementSnippetForFinding(f, points);

  return [
    {
      title: `Create or update ${wrapperFile}`,
      language: "ts",
      copyLabel: "Copy wrapper file",
      code: `import OpenAI from "openai";
import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";

const client = new OpenAI({
  apiKey: process.env.${env},${baseUrlLine}
});

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

export async function chatWithSpectyra(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]) {
  const { providerResult, report } = await spectyra.complete(
    {
      provider: "${provider}",
      client,
      model: "${model}",
      messages,
    },
    createOpenAIAdapter(),
  );

  console.log(\`[Spectyra] estimated savings: \${report.estimatedSavingsPct.toFixed(1)}%\`);

  return providerResult;
}
`,
    },
    ...(replacement ? [replacement] : []),
  ];
}

function groqNativeBlocks(f: AiUsageFinding, points: IntegrationPoint[]): DoctorCodeBlock[] {
  const wrapperFile = suggestedWrapperFile(f, points);
  const model = firstModel(f, "llama-3.3-70b-versatile");
  const replacement = replacementSnippetForFinding(f, points);

  return [
    {
      title: `Create or update ${wrapperFile}`,
      language: "ts",
      copyLabel: "Copy Groq wrapper",
      code: `import Groq from "groq-sdk";
import { createSpectyra, createGroqAdapter } from "@spectyra/sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

export async function chatWithSpectyra(messages: Groq.Chat.ChatCompletionMessageParam[]) {
  const { providerResult, report } = await spectyra.complete(
    {
      provider: "groq",
      client: groq,
      model: "${model}",
      messages,
    },
    createGroqAdapter(),
  );

  console.log(\`[Spectyra] estimated savings: \${report.estimatedSavingsPct.toFixed(1)}%\`);

  return providerResult;
}
`,
    },
    ...(replacement ? [replacement] : []),
  ];
}

function anthropicBlocks(f: AiUsageFinding, points: IntegrationPoint[]): DoctorCodeBlock[] {
  const wrapperFile = suggestedWrapperFile(f, points);
  const model = firstModel(f, "claude-3-5-haiku-latest");
  const replacement = replacementSnippetForFinding(f, points);

  return [
    {
      title: `Create or update ${wrapperFile}`,
      language: "ts",
      copyLabel: "Copy Anthropic wrapper",
      code: `import Anthropic from "@anthropic-ai/sdk";
import { createSpectyra, createAnthropicAdapter } from "@spectyra/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

export async function messageWithSpectyra(messages: Anthropic.Messages.MessageParam[]) {
  const { providerResult, report } = await spectyra.complete(
    {
      provider: "anthropic",
      client: anthropic,
      model: "${model}",
      messages,
    },
    createAnthropicAdapter(),
  );

  console.log(\`[Spectyra] estimated savings: \${report.estimatedSavingsPct.toFixed(1)}%\`);

  return providerResult;
}
`,
    },
    ...(replacement ? [replacement] : []),
  ];
}

function vercelAiBlocks(f: AiUsageFinding): DoctorCodeBlock[] {
  const model = firstModel(f, "gpt-4o-mini");

  return [
    {
      title: "Add Vercel AI SDK monitor hooks",
      language: "ts",
      copyLabel: "Copy Vercel AI snippet",
      code: `import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  createSpectyra,
  createSpectyraVercelAiOnFinish,
  createSpectyraVercelAiTelemetryMetadata,
} from "@spectyra/sdk";

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

const startedAtMs = Date.now();
const result = streamText({
  model: openai("${model}"),
  messages,
  experimental_telemetry: createSpectyraVercelAiTelemetryMetadata({
    provider: "openai",
    model: "${model}",
    endpoint: "${f.relativePath}",
  }),
  onFinish: createSpectyraVercelAiOnFinish(
    spectyra.recordMonitorEvent.bind(spectyra),
    {
      provider: "openai",
      model: "${model}",
      endpoint: "${f.relativePath}",
    },
    startedAtMs,
  ),
});
`,
    },
  ];
}

function langChainBlocks(f: AiUsageFinding): DoctorCodeBlock[] {
  const model = firstModel(f, "gpt-4o-mini");

  return [
    {
      title: "Add LangChain monitor callbacks",
      language: "ts",
      copyLabel: "Copy LangChain snippet",
      code: `import { ChatOpenAI } from "@langchain/openai";
import { createSpectyra, createSpectyraLangChainMonitorCallbacks } from "@spectyra/sdk";

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

const model = new ChatOpenAI({
  model: "${model}",
  apiKey: process.env.OPENAI_API_KEY,
  callbacks: [
    createSpectyraLangChainMonitorCallbacks(
      spectyra.recordMonitorEvent.bind(spectyra),
      {
        provider: "openai",
        model: "${model}",
        endpoint: "${f.relativePath}",
      },
    ),
  ],
});
`,
    },
  ];
}

function llamaIndexBlocks(f: AiUsageFinding): DoctorCodeBlock[] {
  const model = firstModel(f, "gpt-4o-mini");
  return [
    {
      title: "Add LlamaIndex monitor subscriber",
      language: "ts",
      copyLabel: "Copy LlamaIndex snippet",
      code: `import { createSpectyra, createSpectyraLlamaIndexMonitorSubscriber } from "@spectyra/sdk";

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

const spectyraSubscriber = createSpectyraLlamaIndexMonitorSubscriber(
  spectyra.recordMonitorEvent.bind(spectyra),
  {
    provider: "openai",
    model: "${model}",
    endpoint: "${f.relativePath}",
  },
);

// Attach spectyraSubscriber to your LlamaIndex callback manager / Settings.callbackManager.
`,
    },
  ];
}

function pythonReviewBlocks(f: AiUsageFinding): DoctorCodeBlock[] {
  return [
    {
      title: "Python usage detected",
      language: "text",
      copyLabel: "Copy note",
      code: `Doctor detected Python LLM usage at ${f.relativePath}:${f.line}.

Do not paste TypeScript wrapper code into this file.

Next options:
1. If this Python code routes through a Node API gateway, integrate @spectyra/sdk in that Node layer.
2. If this Python service calls the provider directly, use the Spectyra Python SDK once its wrapper API is available for this app.
3. Keep @spectyra/doctor feedback active and rescan after integration.`,
    },
  ];
}

function genericBlocks(f: AiUsageFinding): DoctorCodeBlock[] {
  return [
    {
      title: "Add auto import first",
      language: "ts",
      copyLabel: "Copy auto import",
      code: `// Add this as the first import in your server entrypoint.
import "@spectyra/sdk/auto";`,
    },
    {
      title: "Manual review required",
      language: "text",
      copyLabel: "Copy review note",
      code: `Doctor detected ${f.provider} usage at ${f.relativePath}:${f.line}, but there is not yet a dedicated wrapper template for this provider.

Recommended:
1. Add @spectyra/sdk/auto at the server entrypoint.
2. Centralize this provider call into a shared LLM wrapper.
3. Use createSpectyra + the matching adapter if one exists in @spectyra/sdk.
4. Rescan Doctor to verify integration.`,
    },
  ];
}
