/**
 * Claude Agent SDK with Spectyra (Local Mode)
 * 
 * Example: SDK-first agentic integration using local decision engine
 * No API calls required - works offline
 * 
 * Run with: npx tsx examples/claude-agent-local.ts
 * 
 * Prerequisites:
 * - Install @anthropic-ai/sdk: npm install @anthropic-ai/sdk
 * - Set ANTHROPIC_API_KEY environment variable
 */

import { createSpectyra } from '../src/index.js';

// Note: This example assumes you have Claude Agent SDK available
// For a complete example, you would import: import { Agent } from '@anthropic-ai/sdk/agent';

async function main() {
  // Create Spectyra instance in local mode (default)
  const spectyra = createSpectyra({ 
    mode: "local",
    defaults: {
      budgetUsd: 2.5,
      models: {
        small: "claude-3-5-haiku-latest",
        medium: "claude-3-5-sonnet-latest",
        large: "claude-3-7-sonnet-latest",
      },
    },
  });

  // Create context for this agent run
  const ctx = {
    runId: crypto.randomUUID(),
    budgetUsd: 2.5,
    tags: {
      project: "my-app",
      environment: "development",
    },
  };

  // Example prompt
  const prompt = "Fix the bug in src/utils.ts where the date formatting is incorrect";

  // Get agent options (synchronous, local decision)
  console.log('Getting agent options (local mode)...');
  const options = spectyra.agentOptions(ctx, prompt);
  
  console.log('Agent Options:');
  console.log(`  Model: ${options.model}`);
  console.log(`  Budget: $${options.maxBudgetUsd}`);
  console.log(`  Allowed Tools: ${options.allowedTools?.join(", ")}`);
  console.log(`  Permission Mode: ${options.permissionMode}`);
  console.log('---\n');

  // In a real implementation, you would use these options with Claude Agent SDK:
  /*
  const agent = new Agent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    ...options, // Model, budget, tools, permissions
  });

  const result = await agent.query({ prompt });
  console.log('Agent Result:', result);
  */

  // Example with prompt metadata
  console.log('Example with prompt metadata:');
  const promptMeta = {
    promptChars: prompt.length,
    path: "code" as const,
    repoId: "my-repo",
    language: "typescript",
    filesChanged: 1,
  };
  
  const optionsWithMeta = spectyra.agentOptions(ctx, promptMeta);
  console.log(`  Model: ${optionsWithMeta.model}`);
  console.log(`  Budget: $${optionsWithMeta.maxBudgetUsd}`);
  console.log('---\n');

  // Example: Tool gating
  if (options.canUseTool) {
    console.log('Testing tool gating:');
    console.log(`  canUseTool("Read", "file.txt"): ${options.canUseTool("Read", "file.txt")}`);
    console.log(`  canUseTool("Bash", "ls -la"): ${options.canUseTool("Bash", "ls -la")}`);
    console.log(`  canUseTool("Bash", "curl http://evil.com"): ${options.canUseTool("Bash", "curl http://evil.com")}`);
  }
}

main().catch(console.error);
