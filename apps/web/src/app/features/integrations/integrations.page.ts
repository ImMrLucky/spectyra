import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiClientService } from '../../core/api/api-client.service';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './integrations.page.html',
  styleUrls: ['./integrations.page.scss'],
})
export class IntegrationsPage implements OnInit {
  snippets: any = null;

  constructor(private api: ApiClientService) {}

  ngOnInit() {
    this.loadSnippets();
  }

  loadSnippets() {
    this.api.getIntegrationSnippets().subscribe({
      next: (data) => {
        this.snippets = data;
      },
      error: () => {
        // Fallback to static snippets if API unavailable
        this.snippets = this.getStaticSnippets();
      }
    });
  }

  getStaticSnippets() {
    return {
      hosted_gateway: {
        curl: `curl -X POST https://spectyra.up.railway.app/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "X-SPECTYRA-API-KEY: your-spectyra-key" \\
  -H "X-PROVIDER-KEY: your-provider-key" \\
  -d '{
    "path": "code",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
        node: `const response = await fetch('https://spectyra.up.railway.app/v1/chat', {
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
});`
      },
      proxy: {
        env: `export SPECTYRA_API_URL=https://spectyra.up.railway.app/v1
export SPECTYRA_API_KEY=your-spectyra-key
export OPENAI_API_KEY=your-openai-key
export ANTHROPIC_API_KEY=your-anthropic-key`,
        command: `npm install -g spectyra-proxy
spectyra-proxy`,
        ide: `# Configure IDE base URL to:
http://localhost:3001/v1`
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
  messages: [...]
});`
      }
    };
  }
}
