/**
 * Claude Agent SDK with Spectyra (API Mode)
 * 
 * Example: Enterprise control plane integration with telemetry
 * Requires Spectyra API endpoint and API key
 * 
 * Run with: npx tsx examples/claude-agent-remote.ts
 * 
 * Prerequisites:
 * - Set SPECTYRA_API_URL environment variable
 * - Set SPECTYRA_API_KEY environment variable
 * - Install @anthropic-ai/sdk: npm install @anthropic-ai/sdk
 * - Set ANTHROPIC_API_KEY environment variable
 */

import { createSpectyra } from '../src/index.js';

// Note: This example assumes you have Claude Agent SDK available
// For a complete example, you would import: import { Agent } from '@anthropic-ai/sdk/agent';

async function main() {
  // Create Spectyra instance in API mode
  const spectyra = createSpectyra({
    mode: "api",
    endpoint: process.env.SPECTYRA_API_URL || 'https://spectyra.up.railway.app/v1',
    apiKey: process.env.SPECTYRA_API_KEY || '',
    defaults: {
      budgetUsd: 5.0,
    },
  });

  if (!process.env.SPECTYRA_API_KEY) {
    throw new Error("SPECTYRA_API_KEY environment variable is required for API mode");
  }

  // Create context for this agent run
  const ctx = {
    runId: crypto.randomUUID(),
    budgetUsd: 5.0,
    tags: {
      project: "my-app",
      environment: "production",
    },
  };

  // Example prompt
  const prompt = "Refactor the authentication module to use JWT tokens";

  // Create prompt metadata (avoid sending full prompt by default)
  const promptMeta = {
    promptChars: prompt.length,
    path: "code" as const,
    repoId: "my-repo",
    language: "typescript",
    filesChanged: 3,
  };

  // Fetch agent options from remote API
  console.log('Fetching agent options from API...');
  const response = await spectyra.agentOptionsRemote(ctx, promptMeta);
  
  // Update ctx with run_id returned from API
  ctx.runId = response.run_id;
  
  console.log('Agent Options Response:');
  console.log(`  Run ID: ${response.run_id}`);
  console.log(`  Model: ${response.options.model}`);
  console.log(`  Budget: $${response.options.maxBudgetUsd}`);
  console.log(`  Allowed Tools: ${response.options.allowedTools?.join(", ")}`);
  console.log(`  Permission Mode: ${response.options.permissionMode}`);
  console.log('  Reasons:', response.reasons);
  console.log('---\n');

  // In a real implementation, you would use these options with Claude Agent SDK:
  /*
  const agent = new Agent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    ...response.options,
  });

  const result = await agent.query({ prompt });
  console.log('Agent Result:', result);
  */

  // Example: Stream events for telemetry
  console.log('Example: Streaming events for telemetry...');
  
  // Simulate agent events (in real usage, these come from agent SDK)
  const mockEvents = [
    { type: "tool_call", tool: "Read", input: "src/auth.ts" },
    { type: "tool_result", tool: "Read", output: "..." },
    { type: "tool_call", tool: "Edit", input: "src/auth.ts" },
    { type: "complete", result: "Refactored authentication module" },
  ];

  for (const event of mockEvents) {
    await spectyra.sendAgentEvent(ctx, event);
    console.log(`  Sent event: ${event.type}`);
  }
  console.log('---\n');

  // Example: Observe agent stream
  console.log('Example: Observing agent stream...');
  
  async function* mockAgentStream() {
    yield { type: "start", timestamp: Date.now() };
    yield { type: "tool_call", tool: "Read" };
    yield { type: "tool_result", success: true };
    yield { type: "complete", result: "Done" };
  }

  await spectyra.observeAgentStream(ctx, mockAgentStream());
  console.log('  Stream observed and events forwarded');
}

main().catch(console.error);
