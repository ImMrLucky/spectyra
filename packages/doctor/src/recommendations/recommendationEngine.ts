import type { AiCallStyle, AiProviderId, AiUsageType, SpectyraRecommendation } from "../scanner/types.js";

const OPENAI_COMPATIBLE: AiProviderId[] = [
  "openai",
  "groq",
  "openrouter",
  "together",
  "perplexity",
  "azure-openai",
  "openai-compatible",
  "custom-gateway",
];

function openAiAdapterSnippet(_primaryEntry: string, streaming: boolean): string {
  const streamNote = streaming
    ? "\n// Streaming: route through your existing stream helper; avoid buffering the full body before returning."
    : "";
  return `import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { providerResult, report } = await spectyra.complete(
  { provider: "openai", client, model: "gpt-4o-mini", messages },
  createOpenAIAdapter(),
);
// Use providerResult like the raw SDK response; inspect report for savings.${streamNote}
`;
}

function anthropicAdapterSnippet(streaming: boolean): string {
  const streamNote = streaming ? "\n// Preserve Anthropic streaming semantics when integrating." : "";
  return `import { createSpectyra, createAnthropicAdapter } from "@spectyra/sdk";
import Anthropic from "@anthropic-ai/sdk";

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const { providerResult, report } = await spectyra.complete(
  { provider: "anthropic", client, model: "claude-3-5-haiku-latest", messages },
  createAnthropicAdapter(),
);
// Use providerResult like the raw SDK response.${streamNote}
`;
}

function groqNativeSnippet(streaming: boolean): string {
  const streamNote = streaming ? "\n// Preserve streaming when wrapping Groq calls." : "";
  return `import { createSpectyra, createGroqAdapter } from "@spectyra/sdk";
import Groq from "groq-sdk";

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const { providerResult, report } = await spectyra.complete(
  { provider: "groq", client, model: "llama-3.3-70b-versatile", messages },
  createGroqAdapter(),
);
// Use providerResult like the raw SDK response.${streamNote}
`;
}

function autoImportOnlySnippet(primaryEntry: string): string {
  return `// Add as the first import in your server entry (e.g. ${primaryEntry})
import "@spectyra/sdk/auto";`;
}

/** Provider-aware setup guidance using only real \`@spectyra/sdk\` exports. */
export function buildSpectyraFindingRecommendation(args: {
  provider: AiProviderId;
  usageType: AiUsageType;
  callStyle: AiCallStyle;
  primaryEntry: string;
  packageDir?: string;
}): SpectyraRecommendation {
  const streaming = args.usageType === "streaming" || args.usageType === "audio";
  const notes: string[] = [
    "Prefer `import \"@spectyra/sdk/auto\"` at your Node server entry for automatic metadata capture where supported.",
  ];

  let suggestedCode: string;
  let title: string;

  if (args.provider === "anthropic") {
    title = "Instrument Anthropic with Spectyra";
    suggestedCode = anthropicAdapterSnippet(streaming);
    notes.push("Uses `createSpectyra` + `createAnthropicAdapter` from `@spectyra/sdk`.");
  } else if (args.provider === "groq" && args.callStyle === "sdk") {
    title = "Instrument Groq with Spectyra";
    suggestedCode = groqNativeSnippet(streaming);
    notes.push("Uses `createGroqAdapter` for the official Groq SDK.");
  } else if (OPENAI_COMPATIBLE.includes(args.provider)) {
    title = `Instrument ${args.provider} (OpenAI-compatible path)`;
    suggestedCode = openAiAdapterSnippet("", streaming);
    notes.push("Uses `createOpenAIAdapter` for OpenAI-compatible clients (OpenAI, compatible gateways, Azure OpenAI in OpenAI SDK shape).");
  } else if (args.provider === "gemini" || args.provider === "aws-bedrock" || args.provider === "vercel-ai-sdk") {
    title = `Instrument ${args.provider}`;
    suggestedCode = autoImportOnlySnippet(args.primaryEntry);
    notes.push(
      "No dedicated Gemini/Bedrock adapter export in `@spectyra/sdk` today — use `import \"@spectyra/sdk/auto\"` at the server entry and centralize provider calls for capture.",
    );
  } else {
    title = `Instrument ${args.provider}`;
    suggestedCode = autoImportOnlySnippet(args.primaryEntry);
    notes.push("Add auto import first; then introduce `createSpectyra` + the matching adapter where your code uses a supported provider client.");
  }

  if (args.usageType === "embedding") {
    notes.push("Embeddings: add batching and cache/reuse vectors where safe.");
  }

  return {
    priority: "high",
    title,
    summary: `Detected ${args.callStyle} ${args.usageType} usage for ${args.provider}.`,
    installPackage: "@spectyra/sdk",
    setupLocation: args.primaryEntry,
    wrapperLocation: args.packageDir,
    suggestedImport: `import "@spectyra/sdk/auto";`,
    suggestedCode,
    notes,
    estimatedEffort: "15 minutes",
    confidence: 0.75,
  };
}
