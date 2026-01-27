/**
 * Chat Optimization (Remote API Mode)
 * 
 * Example: Using Spectyra for chat optimization via remote API
 * This is the legacy chat optimization use case (not agentic)
 * 
 * Run with: npx tsx examples/chat-remote.ts
 * 
 * Prerequisites:
 * - Set SPECTYRA_API_URL environment variable
 * - Set SPECTYRA_API_KEY environment variable
 * - Set OPENAI_API_KEY (or other provider key) environment variable
 * 
 * Note: For agentic use cases, use createSpectyra() with agentOptions()
 * See: examples/claude-agent-local.ts and examples/claude-agent-remote.ts
 */

import { SpectyraClient } from '../src/index.js';

async function main() {
  // Initialize client
  const client = new SpectyraClient({
    apiUrl: process.env.SPECTYRA_API_URL || 'https://spectyra.up.railway.app/v1',
    spectyraKey: process.env.SPECTYRA_API_KEY || '',
    provider: 'openai',
    providerKey: process.env.OPENAI_API_KEY || '',
  });

  // Example 1: Basic chat
  console.log('Example 1: Basic chat');
  const response1 = await client.chat({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'Explain quantum computing in one sentence.' }
    ],
    path: 'talk',
    optimization_level: 2,
  });

  console.log(`Response: ${response1.response_text}`);
  console.log(`Tokens used: ${response1.usage.total_tokens}`);
  console.log(`Cost: $${response1.cost_usd.toFixed(4)}`);
  if (response1.savings) {
    console.log(`Savings: ${response1.savings.pct_saved.toFixed(1)}% (${response1.savings.tokens_saved} tokens)`);
  }
  console.log('---\n');

  // Example 2: Estimate savings (dry run)
  console.log('Example 2: Estimate savings (dry run)');
  const estimate = await client.estimateSavings({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'What is React?' },
      { role: 'assistant', content: 'React is a JavaScript library for building user interfaces...' },
      { role: 'user', content: 'How does it compare to Vue?' },
    ],
    path: 'talk',
    optimization_level: 3,
  });

  console.log(`Estimated baseline tokens: ${estimate.baseline_estimate?.total_tokens || 'N/A'}`);
  console.log(`Estimated optimized tokens: ${estimate.optimized_estimate?.total_tokens || 'N/A'}`);
  if (estimate.savings) {
    console.log(`Estimated savings: ${estimate.savings.pct_saved.toFixed(1)}%`);
  }
  console.log('---\n');

  // Example 3: Code workflow
  console.log('Example 3: Code workflow');
  const codeResponse = await client.chat({
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'user', content: 'Fix this bug: function add(a, b) { return a - b; }' }
    ],
    path: 'code',
    optimization_level: 3,
  });

  console.log(`Response: ${codeResponse.response_text}`);
  console.log(`Tokens used: ${codeResponse.usage.total_tokens}`);
  if (codeResponse.savings) {
    console.log(`Savings: ${codeResponse.savings.pct_saved.toFixed(1)}%`);
  }
}

main().catch(console.error);
