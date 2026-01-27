/**
 * Core Agent Message Optimizer
 * 
 * Internal function that applies Core Moat v1 optimizations to agent messages.
 * This calls the Spectyra API endpoint for optimization.
 */

import type { RepoContext, OptimizationReportPublic } from "../types";

/**
 * Internal ChatMessage format (matches optimizer)
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

/**
 * Input for agent message optimization
 */
export interface OptimizeAgentMessagesInput {
  messages: ChatMessage[];
  repoContext?: RepoContext;
  mode: "auto" | "code" | "chat";
  runId?: string;
  turnIndex?: number;
  apiEndpoint?: string;
  apiKey?: string;
}

/**
 * Output from agent message optimization
 */
export interface OptimizeAgentMessagesOutput {
  messages: ChatMessage[];
  optimizationReport: OptimizationReportPublic;
  cacheKey?: string;
  cacheHit?: boolean;
  debugInternal?: any; // For internal debugging only
}

/**
 * Determine path (code vs chat) from mode and context
 */
function determinePath(mode: "auto" | "code" | "chat", repoContext?: RepoContext): "code" | "talk" {
  if (mode === "code") return "code";
  if (mode === "chat") return "talk";
  // Auto mode: use code if repoContext provided
  return repoContext ? "code" : "talk";
}

/**
 * Build CodeMap from repo context and inject into messages
 */
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
    
    // Insert CodeMap as first system message
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

/**
 * Detect language from file path
 */
function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "typescript",
    js: "javascript",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    c: "c",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
  };
  return langMap[ext || ""] || "text";
}

/**
 * Optimize agent messages using Core Moat v1 via API
 * 
 * This function applies:
 * - CodeMap (if repoContext provided and mode is code)
 * - RefPack (for tool outputs and repeated content)
 * - PhraseBook (for repeated phrases in prose)
 * - Semantic cache (if enabled)
 * 
 * NOTE: This calls the /v1/chat endpoint in dry-run mode to get optimized messages
 * without making the actual LLM call. The agent framework then uses these optimized
 * messages to make its own LLM call.
 */
export async function optimizeAgentMessages(
  input: OptimizeAgentMessagesInput
): Promise<OptimizeAgentMessagesOutput> {
  const { messages, repoContext, mode, runId, turnIndex = 0, apiEndpoint, apiKey } = input;
  const path = determinePath(mode, repoContext);
  
  // If no API endpoint/key provided, apply CodeMap only (local optimization)
  if (!apiEndpoint || !apiKey) {
    let optimizedMessages = [...messages];
    
    // Apply CodeMap if repoContext provided
    if (repoContext && path === "code") {
      optimizedMessages = injectCodeMap(optimizedMessages, repoContext);
    }
    
    return {
      messages: optimizedMessages,
      optimizationReport: {
        layers: {
          refpack: false,
          phrasebook: false,
          codemap: !!repoContext && path === "code",
          semantic_cache: false,
          cache_hit: false,
        },
        tokens: {
          estimated: false,
        },
      },
    };
  }
  
  // Inject CodeMap if repoContext provided (before API call)
  let messagesWithCodeMap = messages;
  if (repoContext && path === "code") {
    messagesWithCodeMap = injectCodeMap(messages, repoContext);
  }
  
  // Call API endpoint for full optimization
  // Use dry-run mode to get optimized messages without LLM call
  try {
    const response = await fetch(`${apiEndpoint}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SPECTYRA-API-KEY": apiKey,
      },
      body: JSON.stringify({
        path,
        provider: "openai", // Placeholder - not used in dry-run
        model: "gpt-4o-mini", // Placeholder - not used in dry-run
        messages: messagesWithCodeMap.map(m => ({
          role: m.role,
          content: m.content,
        })),
        mode: "optimized",
        conversation_id: runId,
        optimization_level: 2, // Balanced optimization
        dry_run: true, // Get optimized messages without LLM call
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Extract optimized messages from response
    // In dry-run mode, the API doesn't return optimized messages directly
    // We need to use the messages we sent (which may have been optimized server-side)
    // For now, if we don't get optimized messages back, use CodeMap-injected messages
    // TODO: Add a dedicated /v1/optimize endpoint that returns optimized messages without LLM call
    let optimizedChatMessages: ChatMessage[] = messagesWithCodeMap;
    
    // If API returns optimized messages (future endpoint), use them
    if (result.prompt_final?.messages) {
      optimizedChatMessages = result.prompt_final.messages.map((m: any) => ({
        role: m.role as "system" | "user" | "assistant" | "tool",
        content: m.content,
      }));
    }
    
    // Build optimization report from API response
    // The API returns optimizations_applied and token_breakdown in the response
    const optimizationsApplied = result.optimizations_applied || [];
    const tokenBreakdown = result.token_breakdown || {};
    
    const totalSaved = (tokenBreakdown.refpack?.saved || 0) +
                      (tokenBreakdown.phrasebook?.saved || 0) +
                      (tokenBreakdown.codemap?.saved || 0);
    const totalBefore = tokenBreakdown.refpack?.before ||
                       tokenBreakdown.phrasebook?.before ||
                       tokenBreakdown.codemap?.before || 0;
    const pctSaved = totalBefore > 0 ? (totalSaved / totalBefore) * 100 : undefined;
    
    const optimizationReport: OptimizationReportPublic = {
      layers: {
        refpack: optimizationsApplied.includes("refpack"),
        phrasebook: optimizationsApplied.includes("phrasebook"),
        codemap: optimizationsApplied.includes("codemap") || (!!repoContext && path === "code"),
        semantic_cache: optimizationsApplied.includes("semantic_cache") || 
                        optimizationsApplied.includes("semantic_cache_hit"),
        cache_hit: optimizationsApplied.includes("semantic_cache_hit"),
      },
      tokens: {
        estimated: result.usage?.estimated || result.mode === "optimized",
        input_before: totalBefore > 0 ? totalBefore : undefined,
        input_after: (tokenBreakdown.refpack?.after ||
                     tokenBreakdown.phrasebook?.after ||
                     tokenBreakdown.codemap?.after) || undefined,
        saved: totalSaved > 0 ? totalSaved : undefined,
        pct_saved: pctSaved,
      },
      spectral: result.spectral_debug ? {
        nNodes: result.spectral_debug.nNodes,
        nEdges: result.spectral_debug.nEdges,
        stabilityIndex: result.spectral_debug.stabilityIndex,
        lambda2: result.spectral_debug.lambda2,
      } : undefined,
    };
    
    return {
      messages: optimizedChatMessages,
      optimizationReport,
      cacheKey: result.debug_internal?.cache?.key,
      cacheHit: result.debug_internal?.cache?.hit || false,
      debugInternal: result.debug_internal,
    };
  } catch (error) {
    // Fallback to local CodeMap-only optimization
    console.warn("API optimization failed, using local CodeMap only:", error);
    
    let optimizedMessages = [...messages];
    if (repoContext && path === "code") {
      optimizedMessages = injectCodeMap(optimizedMessages, repoContext);
    }
    
    return {
      messages: optimizedMessages,
      optimizationReport: {
        layers: {
          refpack: false,
          phrasebook: false,
          codemap: !!repoContext && path === "code",
          semantic_cache: false,
          cache_hit: false,
        },
        tokens: {
          estimated: false,
        },
      },
    };
  }
}
