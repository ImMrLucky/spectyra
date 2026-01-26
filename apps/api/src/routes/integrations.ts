import { Router } from "express";

export const integrationsRouter = Router();

/**
 * GET /v1/integrations/snippets
 * Returns code snippets for different integration methods
 */
integrationsRouter.get("/snippets", (req, res) => {
  const baseUrl = process.env.SPECTYRA_API_URL || "https://spectyra.up.railway.app/v1";
  
  res.json({
    hosted_gateway: {
      curl: `curl -X POST ${baseUrl}/chat \\
  -H "Content-Type: application/json" \\
  -H "X-SPECTYRA-API-KEY: your-spectyra-key" \\
  -H "X-PROVIDER-KEY: your-provider-key" \\
  -d '{
    "path": "code",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
      node: `const response = await fetch('${baseUrl}/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-SPECTYRA-API-KEY': 'your-spectyra-key',
    'X-PROVIDER-KEY': 'your-provider-key'
  },
  body: JSON.stringify({
    path: 'code',
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello' }]
  })
});

const data = await response.json();`
    },
    proxy: {
      env: `export SPECTYRA_API_URL=${baseUrl}
export SPECTYRA_API_KEY=your-spectyra-key
export OPENAI_API_KEY=your-openai-key
export ANTHROPIC_API_KEY=your-anthropic-key`,
      command: `npm install -g spectyra-proxy
spectyra-proxy`,
      ide: `# Configure your IDE to use:
# Base URL: http://localhost:3001/v1
# 
# Cursor: Settings → API → OpenAI API Base URL
# VS Code/Copilot: Set OPENAI_API_BASE environment variable
# Claude Code: Settings → Custom API endpoint`
    },
    sdk: {
      usage: `// Server-side only - never expose in browser
import { SpectyraClient } from '@spectyra/sdk';

const client = new SpectyraClient({
  apiKey: process.env.SPECTYRA_API_KEY,
  providerKey: process.env.PROVIDER_KEY
});

const result = await client.optimize({
  path: 'code',
  provider: 'openai',
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Hello' }
  ]
});

console.log(result.response_text);`
    }
  });
});
