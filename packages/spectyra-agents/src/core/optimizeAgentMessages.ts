/**
 * Core Agent Message Optimizer
 *
 * Applies Core Moat v1 optimizations to agent messages.
 * Works fully local-first — no Spectyra cloud dependency for the primary path.
 * Optionally calls the Spectyra API for deeper server-side optimizations.
 */

import type { RepoContext, OptimizationReportPublic, SpectyraRunMode, SavingsReport, PromptComparison } from "../types";
import type { ChatMessage } from "@spectyra/shared";
import { normalizeSpectyraRunMode } from "@spectyra/core-types";

export type { ChatMessage };

export interface OptimizeAgentMessagesInput {
  messages: ChatMessage[];
  repoContext?: RepoContext;
  mode: "auto" | "code" | "chat";
  runMode?: SpectyraRunMode;
  runId?: string;
  turnIndex?: number;
  /** @deprecated Use local-first mode instead. Optional API endpoint for server-side optimization. */
  apiEndpoint?: string;
  /** @deprecated Use local-first mode instead. */
  apiKey?: string;
}

export interface OptimizeAgentMessagesOutput {
  messages: ChatMessage[];
  optimizationReport: OptimizationReportPublic;
  savingsReport?: SavingsReport;
  promptComparison?: PromptComparison;
  cacheKey?: string;
  cacheHit?: boolean;
  debugInternal?: unknown;
}

function determinePath(mode: "auto" | "code" | "chat", repoContext?: RepoContext): "code" | "talk" {
  if (mode === "code") return "code";
  if (mode === "chat") return "talk";
  return repoContext ? "code" : "talk";
}

function injectCodeMap(messages: ChatMessage[], repoContext: RepoContext): ChatMessage[] {
  const lines: string[] = [];

  if (repoContext.files && repoContext.files.length > 0) {
    lines.push("CODEMAP v1.1");
    lines.push("MODE: code");
    lines.push("");
    lines.push("CODEMAP {");
    lines.push("  symbols: []");
    lines.push("  exports: []");
    lines.push("  imports: []");
    lines.push("  dependencies: []");
    lines.push("  snippets_meta: [");

    repoContext.files.forEach((file, idx) => {
      const lang = repoContext.languageHint || detectLanguage(file.path);
      const linesCount = file.content.split("\n").length;
      lines.push(`    {id: "snippet_${idx + 1}", lang: "${lang}", lines: ${linesCount}}`);
    });

    lines.push("  ]");
    lines.push("}");
    lines.push("");
    lines.push("SNIPPETS {");

    repoContext.files.forEach((file, idx) => {
      const lang = repoContext.languageHint || detectLanguage(file.path);
      lines.push(`  snippet_${idx + 1}:`);
      lines.push(`  \`\`\`${lang}`);
      lines.push(file.content);
      lines.push("```");
      lines.push("");
    });

    lines.push("}");
    lines.push("");
    lines.push("RULES:");
    lines.push("  - Treat [[CODEMAP:snippet_id]] as dereferenceable aliases to SNIPPETS.");
    lines.push("  - Do NOT invent code not present.");
    lines.push("  - If required code is missing, request it.");

    const codeMapContent = lines.join("\n");
    const systemMsgs = messages.filter(m => m.role === "system");
    const nonSystemMsgs = messages.filter(m => m.role !== "system");
    return [
      { role: "system", content: codeMapContent },
      ...systemMsgs,
      ...nonSystemMsgs,
    ];
  }

  return messages;
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "typescript", js: "javascript", py: "python", go: "go",
    rs: "rust", java: "java", cpp: "cpp", c: "c",
    html: "html", css: "css", scss: "scss", json: "json",
    yaml: "yaml", yml: "yaml", md: "markdown",
  };
  return langMap[ext || ""] || "text";
}

/**
 * Lightweight local optimizations (no API required).
 */
function applyLocalOptimizations(messages: ChatMessage[]): { messages: ChatMessage[]; transforms: string[] } {
  const transforms: string[] = [];
  let optimized = [...messages];

  // Normalize whitespace
  optimized = optimized.map(m => ({
    ...m,
    content: m.content.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(),
  }));
  transforms.push("whitespace_normalize");

  // Deduplicate consecutive identical messages
  const deduped: ChatMessage[] = [];
  for (const msg of optimized) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.role === msg.role && prev.content === msg.content) continue;
    deduped.push(msg);
  }
  if (deduped.length < optimized.length) transforms.push("dedup_consecutive");
  optimized = deduped;

  // Truncate very long tool outputs
  optimized = optimized.map(m => {
    if (m.role === "tool" && m.content.length > 2000) {
      const head = m.content.slice(0, 500);
      const tail = m.content.slice(-500);
      transforms.push("tool_output_truncate");
      return { ...m, content: `${head}\n...[truncated ${m.content.length - 1000} chars]...\n${tail}` };
    }
    return m;
  });

  // Drop old turns if conversation is very long
  if (optimized.length > 20) {
    const systemMsgs = optimized.filter(m => m.role === "system");
    const nonSystem = optimized.filter(m => m.role !== "system");
    optimized = [...systemMsgs, ...nonSystem.slice(-16)];
    transforms.push("context_window_trim");
  }

  return { messages: optimized, transforms };
}

function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const m of messages) chars += m.role.length + m.content.length + 4;
  return Math.ceil(chars / 4);
}

function buildSavingsReport(
  runId: string | undefined,
  runMode: SpectyraRunMode,
  inputTokensBefore: number,
  inputTokensAfter: number,
  transforms: string[],
): SavingsReport {
  const saved = inputTokensBefore - inputTokensAfter;
  const pct = inputTokensBefore > 0 ? (saved / inputTokensBefore) * 100 : 0;
  return {
    runId: runId ?? crypto.randomUUID(),
    mode: runMode,
    integrationType: "sdk-wrapper",
    provider: "unknown",
    model: "unknown",
    inputTokensBefore,
    inputTokensAfter,
    outputTokens: 0,
    estimatedCostBefore: 0,
    estimatedCostAfter: 0,
    estimatedSavings: 0,
    estimatedSavingsPct: pct,
    contextReductionPct: pct > 0 ? pct : undefined,
    telemetryMode: "local",
    promptSnapshotMode: "local_only",
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    transformsApplied: transforms,
    success: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Optimize agent messages.
 *
 * When `runMode` is `off`, returns messages unchanged.
 * When `runMode` is `on` (default), applies local optimizations to message content.
 *
 * Works fully local without API. If apiEndpoint/apiKey are provided,
 * optionally calls server for deeper optimization (legacy/advanced).
 */
export async function optimizeAgentMessages(
  input: OptimizeAgentMessagesInput
): Promise<OptimizeAgentMessagesOutput> {
  const { messages, repoContext, mode, runId, apiEndpoint, apiKey } = input;
  const runMode = normalizeSpectyraRunMode(input.runMode, "on");
  const path = determinePath(mode, repoContext);

  // off → pass through
  if (runMode === "off") {
    return {
      messages: [...messages],
      optimizationReport: {
        layers: { refpack: false, phrasebook: false, codemap: false, semantic_cache: false, cache_hit: false },
        tokens: { estimated: false },
      },
      savingsReport: buildSavingsReport(runId, "off", estimateTokens(messages), estimateTokens(messages), []),
    };
  }

  // Local optimization (works without API)
  let optimizedMessages = [...messages];
  const transforms: string[] = [];

  // CodeMap injection
  if (repoContext && path === "code") {
    optimizedMessages = injectCodeMap(optimizedMessages, repoContext);
    transforms.push("codemap");
  }

  // Apply local transforms
  const localResult = applyLocalOptimizations(optimizedMessages);
  optimizedMessages = localResult.messages;
  transforms.push(...localResult.transforms);

  const inputTokensBefore = estimateTokens(messages);
  const inputTokensAfter = estimateTokens(optimizedMessages);

  const report: OptimizationReportPublic = {
    layers: {
      refpack: false,
      phrasebook: false,
      codemap: transforms.includes("codemap"),
      semantic_cache: false,
      cache_hit: false,
    },
    tokens: {
      estimated: true,
      input_before: inputTokensBefore,
      input_after: inputTokensAfter,
      saved: inputTokensBefore - inputTokensAfter > 0 ? inputTokensBefore - inputTokensAfter : 0,
      pct_saved: inputTokensBefore > 0 ? ((inputTokensBefore - inputTokensAfter) / inputTokensBefore) * 100 : 0,
    },
  };

  const savingsReport = buildSavingsReport(runId, runMode, inputTokensBefore, inputTokensAfter, transforms);

  const promptComparison: PromptComparison = {
    originalMessagesSummary: messages.map(m => ({ role: m.role, contentLength: m.content.length })),
    optimizedMessagesSummary: optimizedMessages.map(m => ({ role: m.role, contentLength: m.content.length })),
    diffSummary: {
      inputTokensBefore,
      inputTokensAfter,
      tokensSaved: Math.max(0, inputTokensBefore - inputTokensAfter),
      pctSaved: report.tokens.pct_saved ?? 0,
      transformsApplied: transforms,
    },
    storageMode: "local_only",
    localOnly: true,
  };

  // on → return optimized messages
  // Optionally try server-side optimization for deeper transforms
  if (apiEndpoint && apiKey) {
    try {
      const serverResult = await callServerOptimization(optimizedMessages, path, runId, apiEndpoint, apiKey);
      if (serverResult) {
        return serverResult;
      }
    } catch {
      // Fall through to local result
    }
  }

  return {
    messages: optimizedMessages,
    optimizationReport: report,
    savingsReport,
    promptComparison,
  };
}

/**
 * @deprecated Server-side optimization via API. Use local mode instead.
 */
async function callServerOptimization(
  messages: ChatMessage[],
  path: string,
  runId: string | undefined,
  apiEndpoint: string,
  apiKey: string,
): Promise<OptimizeAgentMessagesOutput | null> {
  const response = await fetch(`${apiEndpoint}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SPECTYRA-API-KEY": apiKey,
    },
    body: JSON.stringify({
      path,
      provider: "openai",
      model: "gpt-4o-mini",
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      mode: "optimized",
      conversation_id: runId,
      optimization_level: 2,
      dry_run: true,
    }),
  });

  if (!response.ok) return null;

  const result = await response.json() as Record<string, any>;
  let optimizedChatMessages: ChatMessage[] = messages;
  if (result.prompt_final?.messages) {
    optimizedChatMessages = result.prompt_final.messages.map((m: any) => ({
      role: m.role as "system" | "user" | "assistant" | "tool",
      content: m.content,
    }));
  }

  const optimizationsApplied: string[] = result.optimizations_applied || [];
  const tokenBreakdown = result.token_breakdown || {};
  const totalSaved = (tokenBreakdown.refpack?.saved || 0) +
    (tokenBreakdown.phrasebook?.saved || 0) +
    (tokenBreakdown.codemap?.saved || 0);
  const totalBefore = tokenBreakdown.refpack?.before ||
    tokenBreakdown.phrasebook?.before ||
    tokenBreakdown.codemap?.before || 0;

  return {
    messages: optimizedChatMessages,
    optimizationReport: {
      layers: {
        refpack: optimizationsApplied.includes("refpack"),
        phrasebook: optimizationsApplied.includes("phrasebook"),
        codemap: optimizationsApplied.includes("codemap"),
        semantic_cache: optimizationsApplied.includes("semantic_cache") ||
          optimizationsApplied.includes("semantic_cache_hit"),
        cache_hit: optimizationsApplied.includes("semantic_cache_hit"),
      },
      tokens: {
        estimated: result.usage?.estimated || result.mode === "optimized",
        input_before: totalBefore > 0 ? totalBefore : undefined,
        input_after: (tokenBreakdown.refpack?.after || tokenBreakdown.phrasebook?.after || tokenBreakdown.codemap?.after) || undefined,
        saved: totalSaved > 0 ? totalSaved : undefined,
        pct_saved: totalBefore > 0 ? (totalSaved / totalBefore) * 100 : undefined,
      },
      spectral: result.spectral_debug ? {
        nNodes: result.spectral_debug.nNodes,
        nEdges: result.spectral_debug.nEdges,
        stabilityIndex: result.spectral_debug.stabilityIndex,
        lambda2: result.spectral_debug.lambda2,
      } : undefined,
    },
    cacheKey: result.debug_internal?.cache?.key,
    cacheHit: result.debug_internal?.cache?.hit || false,
    debugInternal: result.debug_internal,
  };
}
