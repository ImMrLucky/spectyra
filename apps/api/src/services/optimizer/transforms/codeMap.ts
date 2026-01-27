/**
 * CodeMap Compression
 * 
 * Core Moat v1: For code-heavy prompts, replace raw code dumps with:
 * - CODEMAP JSON/YAML: symbols, signatures, exports
 * - Minimal snippets (top relevant)
 * - Dependency/import summary
 * - Keep only most relevant raw snippets when spectral stability is low
 */

import { ChatMessage } from "../unitize";
import { SpectralResult } from "../spectral/types";

export interface CodeMap {
  symbols: Array<{ name: string; type: string; signature?: string }>;
  exports: string[];
  imports: string[];
  dependencies: string[];
  snippets: Array<{ id: string; lang: string; content: string; lines: number }>;
}

export interface CodeMapInput {
  messages: ChatMessage[];
  spectral: SpectralResult;
  detailLevel: number; // 0-1 scale (1 = full detail, 0 = minimal)
}

export interface CodeMapOutput {
  messages: ChatMessage[];
  codeMap: CodeMap | null;
  tokensBefore: number;
  tokensAfter: number;
  changed: boolean;
}

/**
 * Build CodeMap from code blocks in messages
 */
export function buildCodeMap(input: CodeMapInput): CodeMapOutput {
  const { messages, spectral, detailLevel } = input;

  // Extract all code blocks
  const codeBlocks = extractCodeBlocks(messages);
  
  if (codeBlocks.length === 0) {
    return {
      messages,
      codeMap: null,
      tokensBefore: 0,
      tokensAfter: 0,
      changed: false,
    };
  }

  // Build symbol map, imports, exports
  const symbols: Array<{ name: string; type: string; signature?: string }> = [];
  const exports: string[] = [];
  const imports: string[] = [];
  const dependencies: string[] = [];

  for (const block of codeBlocks) {
    // Extract symbols (functions, classes, variables)
    const blockSymbols = extractSymbols(block.content, block.lang);
    symbols.push(...blockSymbols);

    // Extract exports
    const blockExports = extractExports(block.content, block.lang);
    exports.push(...blockExports);

    // Extract imports
    const blockImports = extractImports(block.content, block.lang);
    imports.push(...blockImports);

    // Extract dependencies (from package.json, requirements.txt, etc.)
    const blockDeps = extractDependencies(block.content, block.lang);
    dependencies.push(...blockDeps);
  }

  // Deduplicate
  const uniqueSymbols = deduplicateSymbols(symbols);
  const uniqueExports = [...new Set(exports)];
  const uniqueImports = [...new Set(imports)];
  const uniqueDeps = [...new Set(dependencies)];

  // Select snippets based on detail level
  // High detail (1.0) = keep all, low detail (0.0) = keep minimal
  const keepSnippets = Math.max(1, Math.ceil(codeBlocks.length * detailLevel));
  const selectedSnippets = codeBlocks
    .sort((a, b) => b.content.length - a.content.length) // Prefer larger blocks
    .slice(0, keepSnippets)
    .map((block, idx) => ({
      id: `snippet_${idx + 1}`,
      lang: block.lang,
      content: block.content,
      lines: block.content.split("\n").length,
    }));

  const codeMap: CodeMap = {
    symbols: uniqueSymbols,
    exports: uniqueExports,
    imports: uniqueImports,
    dependencies: uniqueDeps,
    snippets: selectedSnippets,
  };

  // Estimate tokens
  const tokensBefore = estimateTokens(codeBlocks.map(b => b.content).join("\n"));
  const codeMapText = buildCodeMapText(codeMap);
  const tokensAfter = estimateTokens(codeMapText);

  // Replace code blocks in messages with CodeMap
  const newMessages = replaceCodeBlocksWithCodeMap(messages, codeMap, codeBlocks);

  return {
    messages: newMessages,
    codeMap,
    tokensBefore,
    tokensAfter,
    changed: true,
  };
}

/**
 * Extract code blocks from messages
 */
function extractCodeBlocks(messages: ChatMessage[]): Array<{ lang: string; content: string }> {
  const blocks: Array<{ lang: string; content: string }> = [];

  for (const msg of messages) {
    const content = msg.content;
    // Match fenced code blocks: ```lang\ncontent\n```
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        lang: match[1] || "text",
        content: match[2].trim(),
      });
    }
  }

  return blocks;
}

/**
 * Extract symbols from code (simplified - can be enhanced with AST parsing)
 */
function extractSymbols(code: string, lang: string): Array<{ name: string; type: string; signature?: string }> {
  const symbols: Array<{ name: string; type: string; signature?: string }> = [];

  // Simple regex-based extraction (can be enhanced with proper AST parsing)
  if (lang === "typescript" || lang === "javascript" || lang === "ts" || lang === "js") {
    // Functions
    const funcRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(\w+)\s*:\s*(?:\([^)]*\)\s*=>|\([^)]*\)\s*:\s*\w+))/g;
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
      const name = match[1] || match[2] || match[3];
      if (name) {
        symbols.push({ name, type: "function" });
      }
    }

    // Classes
    const classRegex = /class\s+(\w+)/g;
    while ((match = classRegex.exec(code)) !== null) {
      symbols.push({ name: match[1], type: "class" });
    }
  }

  return symbols;
}

/**
 * Extract exports
 */
function extractExports(code: string, lang: string): string[] {
  const exports: string[] = [];

  if (lang === "typescript" || lang === "javascript" || lang === "ts" || lang === "js") {
    // export const/function/class
    const exportRegex = /export\s+(?:const|function|class|interface|type)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(code)) !== null) {
      exports.push(match[1]);
    }
  }

  return exports;
}

/**
 * Extract imports
 */
function extractImports(code: string, lang: string): string[] {
  const imports: string[] = [];

  if (lang === "typescript" || lang === "javascript" || lang === "ts" || lang === "js") {
    // import ... from "..."
    const importRegex = /import\s+.*?\s+from\s+["']([^"']+)["']/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

/**
 * Extract dependencies
 */
function extractDependencies(code: string, lang: string): string[] {
  const deps: string[] = [];

  if (lang === "json" && code.includes('"dependencies"')) {
    // Parse package.json
    try {
      const json = JSON.parse(code);
      if (json.dependencies) {
        deps.push(...Object.keys(json.dependencies));
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  return deps;
}

/**
 * Deduplicate symbols
 */
function deduplicateSymbols(symbols: Array<{ name: string; type: string }>): Array<{ name: string; type: string }> {
  const seen = new Set<string>();
  const unique: Array<{ name: string; type: string }> = [];

  for (const sym of symbols) {
    const key = `${sym.name}:${sym.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(sym);
    }
  }

  return unique;
}

/**
 * Build CodeMap text for system message
 */
function buildCodeMapText(codeMap: CodeMap): string {
  const lines: string[] = [
    "CODEMAP {",
    `  symbols: [${codeMap.symbols.map(s => `{name: "${s.name}", type: "${s.type}"}`).join(", ")}]`,
    `  exports: [${codeMap.exports.map(e => `"${e}"`).join(", ")}]`,
    `  imports: [${codeMap.imports.map(i => `"${i}"`).join(", ")}]`,
    `  dependencies: [${codeMap.dependencies.map(d => `"${d}"`).join(", ")}]`,
    `  snippets: [`,
  ];

  for (const snippet of codeMap.snippets) {
    lines.push(`    {id: "${snippet.id}", lang: "${snippet.lang}", lines: ${snippet.lines}}`);
  }

  lines.push("  ]");
  lines.push("}");

  return lines.join("\n");
}

/**
 * Replace code blocks in messages with CodeMap reference
 */
function replaceCodeBlocksWithCodeMap(
  messages: ChatMessage[],
  codeMap: CodeMap,
  originalBlocks: Array<{ lang: string; content: string }>
): ChatMessage[] {
  const newMessages: ChatMessage[] = [];

  // Add CodeMap as system message
  const codeMapMsg: ChatMessage = {
    role: "system",
    content: buildCodeMapText(codeMap),
  };

  // Process each message
  for (const msg of messages) {
    let content = msg.content;
    let changed = false;

    // Replace code blocks with CodeMap references
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    content = content.replace(regex, (match, lang, code) => {
      // Check if this block is in our snippets
      const snippet = codeMap.snippets.find(s => s.content === code.trim());
      if (snippet) {
        changed = true;
        return `[[CODEMAP:${snippet.id}]]`; // Reference to snippet
      }
      return match; // Keep original if not in snippets
    });

    newMessages.push({
      ...msg,
      content: changed ? content : msg.content,
    });
  }

  // Insert CodeMap system message at the top
  const systemMsgs = newMessages.filter(m => m.role === "system");
  const nonSystemMsgs = newMessages.filter(m => m.role !== "system");
  return [codeMapMsg, ...systemMsgs, ...nonSystemMsgs];
}

/**
 * Estimate tokens
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
