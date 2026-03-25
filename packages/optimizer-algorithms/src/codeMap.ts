import type { ChatMsg, SpectralResult } from "./types.js";
import { estimateTokens } from "./math.js";

export interface CodeMap {
  symbols: Array<{ name: string; type: string; signature?: string }>;
  exports: string[];
  imports: string[];
  dependencies: string[];
  snippets: Array<{ id: string; lang: string; content: string; lines: number }>;
}

export interface CodeMapInput {
  messages: ChatMsg[];
  spectral: SpectralResult;
  detailLevel: number;
  structuralOnly?: boolean;
}

export interface CodeMapOutput {
  messages: ChatMsg[];
  codeMap: CodeMap | null;
  tokensBefore: number;
  tokensAfter: number;
  changed: boolean;
  omittedBlocks?: Array<{ lang: string; lines: number; reason: string }>;
}

export function buildCodeMap(input: CodeMapInput): CodeMapOutput {
  const { messages, spectral, detailLevel, structuralOnly = false } = input;
  const codeBlocks = extractCodeBlocks(messages);
  if (codeBlocks.length === 0) return { messages, codeMap: null, tokensBefore: 0, tokensAfter: 0, changed: false };
  const symbols: Array<{ name: string; type: string; signature?: string }> = [];
  const exports: string[] = [];
  const imports: string[] = [];
  const dependencies: string[] = [];
  for (const block of codeBlocks) {
    symbols.push(...extractSymbols(block.content, block.lang));
    exports.push(...extractExports(block.content, block.lang));
    imports.push(...extractImports(block.content, block.lang));
    dependencies.push(...extractDependencies(block.content, block.lang));
  }
  const uniqueSymbols = deduplicateSymbols(symbols);
  const uniqueExports = [...new Set(exports)];
  const uniqueImports = [...new Set(imports)];
  const uniqueDeps = [...new Set(dependencies)];
  if (structuralOnly) {
    const codeMap: CodeMap = { symbols: uniqueSymbols, exports: uniqueExports, imports: uniqueImports, dependencies: uniqueDeps, snippets: [] };
    const structuralText = buildCodeMapStructuralText(codeMap);
    const tokensBefore = estimateTokens(codeBlocks.map(b => b.content).join("\n"));
    const newMessages = replaceCodeBlocksWithStructuralRef(messages, structuralText);
    const tokensAfter = estimateTokens(structuralText + newMessages.map(m => m.content).join("\n"));
    return { messages: newMessages, codeMap, tokensBefore, tokensAfter, changed: true };
  }
  const keepSnippets = Math.max(1, Math.ceil(codeBlocks.length * detailLevel));
  const sortedBlocks = codeBlocks.sort((a, b) => b.content.length - a.content.length);
  const selectedBlocks = sortedBlocks.slice(0, keepSnippets);
  const omittedBlocks = sortedBlocks.slice(keepSnippets);
  const selectedSnippets = selectedBlocks.map((block, idx) => ({
    id: `snippet_${idx + 1}`, lang: block.lang, content: block.content, lines: block.content.split("\n").length,
  }));
  const omittedBlocksMeta = omittedBlocks.map(block => ({ lang: block.lang, lines: block.content.split("\n").length, reason: "detailLevel" }));
  const codeMap: CodeMap = { symbols: uniqueSymbols, exports: uniqueExports, imports: uniqueImports, dependencies: uniqueDeps, snippets: selectedSnippets };
  const tokensBefore = estimateTokens(codeBlocks.map(b => b.content).join("\n"));
  const codeMapText = buildCodeMapText(codeMap, omittedBlocksMeta);
  const tokensAfter = estimateTokens(codeMapText);
  const newMessages = replaceCodeBlocksWithCodeMap(messages, codeMap, codeBlocks, omittedBlocksMeta);
  return { messages: newMessages, codeMap, tokensBefore, tokensAfter, changed: true, omittedBlocks: omittedBlocksMeta };
}

function extractCodeBlocks(messages: ChatMsg[]): Array<{ lang: string; content: string }> {
  const blocks: Array<{ lang: string; content: string }> = [];
  for (const msg of messages) {
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(msg.content)) !== null) blocks.push({ lang: match[1] || "text", content: match[2].trim() });
  }
  return blocks;
}

function extractSymbols(code: string, lang: string): Array<{ name: string; type: string; signature?: string }> {
  const symbols: Array<{ name: string; type: string; signature?: string }> = [];
  if (["typescript", "javascript", "ts", "js"].includes(lang)) {
    const funcRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(\w+)\s*:\s*(?:\([^)]*\)\s*=>|\([^)]*\)\s*:\s*\w+))/g;
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
      const name = match[1] || match[2] || match[3];
      if (name) symbols.push({ name, type: "function" });
    }
    const classRegex = /class\s+(\w+)/g;
    while ((match = classRegex.exec(code)) !== null) symbols.push({ name: match[1], type: "class" });
  }
  return symbols;
}

function extractExports(code: string, lang: string): string[] {
  const exports: string[] = [];
  if (["typescript", "javascript", "ts", "js"].includes(lang)) {
    const exportRegex = /export\s+(?:const|function|class|interface|type)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(code)) !== null) exports.push(match[1]);
  }
  return exports;
}

function extractImports(code: string, lang: string): string[] {
  const imports: string[] = [];
  if (["typescript", "javascript", "ts", "js"].includes(lang)) {
    const importRegex = /import\s+.*?\s+from\s+["']([^"']+)["']/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) imports.push(match[1]);
  }
  return imports;
}

function extractDependencies(code: string, lang: string): string[] {
  const deps: string[] = [];
  if (lang === "json" && code.includes('"dependencies"')) {
    try { const json = JSON.parse(code); if (json.dependencies) deps.push(...Object.keys(json.dependencies)); } catch (_e) {}
  }
  return deps;
}

function deduplicateSymbols(symbols: Array<{ name: string; type: string }>): Array<{ name: string; type: string }> {
  const seen = new Set<string>();
  return symbols.filter(sym => { const key = `${sym.name}:${sym.type}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

function buildCodeMapStructuralText(codeMap: CodeMap): string {
  return [
    "CODEMAP (structural)",
    `symbols: [${codeMap.symbols.map(s => `${s.name}:${s.type}`).join(", ")}]`,
    `imports: [${codeMap.imports.map(i => `"${i}"`).join(", ")}]`,
    `exports: [${codeMap.exports.map(e => `"${e}"`).join(", ")}]`,
  ].join("\n");
}

function replaceCodeBlocksWithStructuralRef(messages: ChatMsg[], structuralText: string): ChatMsg[] {
  const ref = "[[CODEMAP:structural]]";
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  const newMessages: ChatMsg[] = [];
  for (const msg of messages) newMessages.push({ ...msg, content: (msg.content ?? "").replace(regex, ref) });
  const systemMsg: ChatMsg = { role: "system", content: structuralText };
  const systemMsgs = newMessages.filter(m => m.role === "system");
  const nonSystemMsgs = newMessages.filter(m => m.role !== "system");
  return [systemMsg, ...systemMsgs, ...nonSystemMsgs];
}

function buildCodeMapText(codeMap: CodeMap, omittedBlocks: Array<{ lang: string; lines: number; reason: string }> = []): string {
  const lines: string[] = [
    "CODEMAP v1.1", "MODE: code", "", "CODEMAP {",
    `  symbols: [${codeMap.symbols.map(s => `{name: "${s.name}", type: "${s.type}"}`).join(", ")}]`,
    `  exports: [${codeMap.exports.map(e => `"${e}"`).join(", ")}]`,
    `  imports: [${codeMap.imports.map(i => `"${i}"`).join(", ")}]`,
    `  dependencies: [${codeMap.dependencies.map(d => `"${d}"`).join(", ")}]`,
    `  snippets_meta: [`,
  ];
  for (const snippet of codeMap.snippets) lines.push(`    {id: "${snippet.id}", lang: "${snippet.lang}", lines: ${snippet.lines}}`);
  lines.push("  ]");
  if (omittedBlocks.length > 0) {
    lines.push("  omitted_blocks: [");
    for (const o of omittedBlocks) lines.push(`    {lang: "${o.lang}", lines: ${o.lines}, reason: "${o.reason}"}`);
    lines.push("  ]");
  }
  lines.push("}", "", "SNIPPETS {");
  for (const snippet of codeMap.snippets) {
    lines.push(`  ${snippet.id}:`, `  \`\`\`${snippet.lang}`, snippet.content, "```", "");
  }
  lines.push("}", "", "RULES:", "  - Treat [[CODEMAP:snippet_id]] as dereferenceable aliases to SNIPPETS.", "  - Do NOT invent code not present.", "  - If required code is missing, request it.");
  return lines.join("\n");
}

function replaceCodeBlocksWithCodeMap(
  messages: ChatMsg[], codeMap: CodeMap,
  _originalBlocks: Array<{ lang: string; content: string }>,
  omittedBlocks: Array<{ lang: string; lines: number; reason: string }> = []
): ChatMsg[] {
  const newMessages: ChatMsg[] = [];
  const codeMapMsg: ChatMsg = { role: "system", content: buildCodeMapText(codeMap, omittedBlocks) };
  const contentToSnippetId = new Map<string, string>();
  for (const snippet of codeMap.snippets) contentToSnippetId.set(snippet.content.trim(), snippet.id);
  for (const msg of messages) {
    let content = msg.content;
    let changed = false;
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    content = content.replace(regex, (_match, _lang, code) => {
      const trimmedCode = code.trim();
      const snippetId = contentToSnippetId.get(trimmedCode);
      changed = true;
      return snippetId ? `[[CODEMAP:${snippetId}]]` : `[[CODEMAP:OMITTED]]`;
    });
    newMessages.push({ ...msg, content: changed ? content : msg.content });
  }
  const systemMsgs = newMessages.filter(m => m.role === "system");
  const nonSystemMsgs = newMessages.filter(m => m.role !== "system");
  return [codeMapMsg, ...systemMsgs, ...nonSystemMsgs];
}
