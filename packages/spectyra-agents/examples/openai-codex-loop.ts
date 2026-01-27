/**
 * Example: OpenAI Codex Agent Loop with Spectyra Optimization
 * 
 * Demonstrates wrapping OpenAI messages with Spectyra optimizations
 * in a tool-using agent loop.
 * 
 * Run with: npx tsx examples/openai-codex-loop.ts
 * 
 * Prerequisites:
 * - Set OPENAI_API_KEY environment variable
 * - Set SPECTYRA_API_KEY environment variable (optional)
 * - Set SPECTYRA_API_ENDPOINT environment variable (optional)
 */

import OpenAI from "openai";
import { wrapOpenAIInput, captureRepoContext } from "../src/index.js";

async function main() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
  
  // Simulate a coding agent loop with repeated tool outputs
  const messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
  }> = [
    {
      role: "system",
      content: "You are a coding assistant. Use tools to read and edit files.",
    },
    {
      role: "user",
      content: "Add error handling to the calculateTotal function.",
    },
    {
      role: "tool",
      name: "read_file",
      content: "File: src/utils.ts\n```typescript\nexport function calculateTotal(items: Item[]): number {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}\n```",
    },
    {
      role: "assistant",
      content: "I'll add error handling. Let me read the Item type definition first.",
    },
    {
      role: "tool",
      name: "read_file",
      content: "File: src/utils.ts\n```typescript\nexport function calculateTotal(items: Item[]): number {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}\n```", // Repeated (RefPack will compress)
    },
  ];
  
  // Capture repo context for CodeMap
  const repoContext = await captureRepoContext({
    rootPath: process.cwd(),
    includeGlobs: ["**/*.ts"],
    excludeGlobs: ["**/node_modules/**"],
    maxBytes: 50000,
    entrypoints: ["src/utils.ts"],
  }).catch(() => undefined);
  
  // Wrap messages with Spectyra optimization
  const { messages: optimizedMessages, optimizationReport } = await wrapOpenAIInput({
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
  console.log(JSON.stringify(optimizationReport, null, 2));
  console.log("");
  
  // Use optimized messages with OpenAI
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: optimizedMessages.map(m => ({
      role: m.role === "tool" ? "user" : m.role,
      content: m.role === "tool"
        ? `[Tool: ${(m as any).name}]\n${m.content}`
        : m.content,
    })) as any,
    max_tokens: 1024,
  });
  
  console.log("OpenAI Response:");
  console.log(response.choices[0].message.content);
  console.log("");
  console.log("Usage:");
  console.log(`  Input tokens: ${response.usage?.prompt_tokens}`);
  console.log(`  Output tokens: ${response.usage?.completion_tokens}`);
}

main().catch(console.error);
