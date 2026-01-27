/**
 * Example: Generic Tool Loop with Spectyra Optimization
 * 
 * Demonstrates the framework-agnostic wrapper for any agent framework.
 * 
 * Run with: npx tsx examples/generic-tool-loop.ts
 * 
 * Prerequisites:
 * - Set SPECTYRA_API_KEY environment variable (optional)
 * - Set SPECTYRA_API_ENDPOINT environment variable (optional)
 */

import { wrapGenericAgentLoop, captureRepoContext } from "../src/index.js";

// Example: Custom agent framework request/response types
interface MyAgentRequest {
  messages: Array<{ role: string; content: string }>;
  model: string;
  temperature?: number;
}

interface MyAgentResponse {
  text: string;
  toolCalls?: Array<{ name: string; args: any }>;
  usage: { input_tokens: number; output_tokens: number };
}

// Example: Custom provider implementation
async function myProvider(req: MyAgentRequest): Promise<MyAgentResponse> {
  // Simulate provider call
  console.log(`Calling provider with ${req.messages.length} messages`);
  
  // In real implementation, this would call your LLM provider
  return {
    text: "I'll help you with that. Let me read the file first.",
    usage: {
      input_tokens: 100,
      output_tokens: 20,
    },
  };
}

async function main() {
  // Capture repo context
  const repoContext = await captureRepoContext({
    rootPath: process.cwd(),
    includeGlobs: ["**/*.ts"],
    excludeGlobs: ["**/node_modules/**"],
    maxBytes: 50000,
  }).catch(() => undefined);
  
  // Wrap the agent loop with Spectyra optimization
  const optimizedLoop = await wrapGenericAgentLoop({
    toMessages: (req: MyAgentRequest) => req.messages,
    fromMessages: (msgs, orig: MyAgentRequest) => ({
      ...orig,
      messages: msgs,
    }),
    callProvider: myProvider,
    getAssistantText: (res: MyAgentResponse) => res.text,
    getToolCalls: (res: MyAgentResponse) => res.toolCalls,
    repoContext,
    mode: "code",
    runId: `run_${Date.now()}`,
    spectyraConfig: {
      apiEndpoint: process.env.SPECTYRA_API_ENDPOINT || "https://spectyra.up.railway.app/v1",
      apiKey: process.env.SPECTYRA_API_KEY,
    },
  });
  
  // Use wrapped function
  const request: MyAgentRequest = {
    messages: [
      { role: "system", content: "You are a coding assistant." },
      { role: "user", content: "Fix the bug in calculateTotal." },
      { role: "tool", content: "File: src/index.ts\n```typescript\nfunction calculateTotal(items) { ... }\n```" },
    ],
    model: "gpt-4o",
  };
  
  const response = await optimizedLoop(request);
  
  console.log("Response:", response.text);
  console.log("Usage:", response.usage);
}

main().catch(console.error);
