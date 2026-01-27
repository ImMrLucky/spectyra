/**
 * Example: Claude SDK Coding Agent with Spectyra Optimization
 * 
 * Demonstrates wrapping Claude SDK messages with Spectyra Core Moat v1
 * optimizations (CodeMap, RefPack, PhraseBook) before LLM calls.
 * 
 * Run with: npx tsx examples/claude-sdk-coding-agent.ts
 * 
 * Prerequisites:
 * - Set ANTHROPIC_API_KEY environment variable
 * - Set SPECTYRA_API_KEY environment variable (optional, for full optimization)
 * - Set SPECTYRA_API_ENDPOINT environment variable (optional)
 */

import Anthropic from "@anthropic-ai/sdk";
import { wrapClaudeRequest, captureRepoContext } from "../src/index.js";

async function main() {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  
  // Example: Coding agent that reads files and makes edits
  const messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_name?: string;
  }> = [
    {
      role: "system",
      content: "You are a coding assistant. Use tools to read files and make edits.",
    },
    {
      role: "user",
      content: "Fix the bug in src/index.ts where the function returns undefined.",
    },
    {
      role: "tool",
      tool_name: "read_file",
      content: "File: src/index.ts\n```typescript\nfunction calculateTotal(items: Item[]): number {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}\n```",
    },
    {
      role: "tool",
      tool_name: "read_file",
      content: "File: src/index.ts\n```typescript\nfunction calculateTotal(items: Item[]): number {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}\n```", // Repeated (will be RefPack'd)
    },
    {
      role: "assistant",
      content: "I see the function. Let me check the Item type definition.",
    },
  ];
  
  // Capture repo context (optional, for CodeMap)
  const repoContext = await captureRepoContext({
    rootPath: process.cwd(),
    includeGlobs: ["**/*.ts", "**/*.tsx"],
    excludeGlobs: ["**/node_modules/**", "**/dist/**"],
    maxBytes: 50000, // 50KB
    entrypoints: ["src/index.ts"],
  }).catch(() => undefined); // Gracefully handle errors
  
  // Wrap messages with Spectyra optimization
  const { messages: optimizedMessages, optimizationReport } = await wrapClaudeRequest({
    messages: messages as any,
    repoContext,
    mode: "code",
    runId: `run_${Date.now()}`,
    config: {
      apiEndpoint: process.env.SPECTYRA_API_ENDPOINT || "https://spectyra.up.railway.app/v1",
      apiKey: process.env.SPECTYRA_API_KEY,
    },
  });
  
  console.log("Optimization Report:");
  console.log(`  RefPack: ${optimizationReport.layers.refpack}`);
  console.log(`  PhraseBook: ${optimizationReport.layers.phrasebook}`);
  console.log(`  CodeMap: ${optimizationReport.layers.codemap}`);
  console.log(`  Cache Hit: ${optimizationReport.layers.cache_hit}`);
  if (optimizationReport.tokens.saved) {
    console.log(`  Tokens Saved: ${optimizationReport.tokens.saved} (${optimizationReport.tokens.pct_saved?.toFixed(1)}%)`);
  }
  console.log("");
  
  // Use optimized messages with Claude SDK
  const response = await claude.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: optimizedMessages.map(m => ({
      role: m.role === "tool" ? "user" : m.role, // Claude SDK doesn't have "tool" role
      content: m.role === "tool" 
        ? `[Tool: ${(m as any).tool_name}]\n${m.content}`
        : m.content,
    })) as any,
  });
  
  console.log("Claude Response:");
  console.log(response.content[0].text);
  console.log("");
  console.log("Usage:");
  console.log(`  Input tokens: ${response.usage.input_tokens}`);
  console.log(`  Output tokens: ${response.usage.output_tokens}`);
}

main().catch(console.error);
