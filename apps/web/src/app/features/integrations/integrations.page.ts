import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiClientService } from '../../core/api/api-client.service';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <h1>Integrations</h1>
      <p class="subtitle">Connect your applications to the Spectyra AI Gateway</p>
      
      <div class="integration-cards">
        <!-- Card A: Hosted Gateway -->
        <div class="integration-card">
          <h2>Hosted Gateway (Recommended)</h2>
          <p>Send your requests to Spectyra instead of OpenAI/Anthropic directly.</p>
          <div class="code-block" *ngIf="snippets?.hosted_gateway">
            <pre><code>{{ snippets.hosted_gateway.curl }}</code></pre>
          </div>
          <div class="code-block" *ngIf="snippets?.hosted_gateway">
            <pre><code>{{ snippets.hosted_gateway.node }}</code></pre>
          </div>
          <div class="info-box">
            <strong>Key Points:</strong>
            <ul>
              <li>Uses <code>X-SPECTYRA-API-KEY</code> (your Spectyra key)</li>
              <li>Uses <code>X-PROVIDER-KEY</code> ephemerally (provider key never stored)</li>
              <li>Works with any OpenAI/Anthropic-compatible client</li>
            </ul>
          </div>
        </div>

        <!-- Card B: Local Proxy -->
        <div class="integration-card">
          <h2>Local Proxy (IDE Tools / Dev Workflows)</h2>
          <p>Use spectyra-proxy to route IDE tools via localhost.</p>
          <div class="code-block" *ngIf="snippets?.proxy">
            <pre><code>{{ snippets.proxy.env }}</code></pre>
          </div>
          <div class="code-block" *ngIf="snippets?.proxy">
            <pre><code>{{ snippets.proxy.command }}</code></pre>
          </div>
          <div class="code-block" *ngIf="snippets?.proxy">
            <pre><code>{{ snippets.proxy.ide }}</code></pre>
          </div>
        </div>

        <!-- Card C: Server SDK -->
        <div class="integration-card">
          <h2>Server SDK / Middleware Wrapper</h2>
          <p>Use a server-side wrapper to route calls via Spectyra.</p>
          <div class="warning-box">
            <strong>⚠️ Important:</strong> Do not use in browser; keys will leak.
          </div>
          <div class="code-block" *ngIf="snippets?.sdk">
            <pre><code>{{ snippets.sdk.usage }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .subtitle {
      color: #666;
      font-size: 16px;
      margin-bottom: 30px;
    }
    .integration-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 24px;
      margin-top: 30px;
    }
    .integration-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .integration-card h2 {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 20px;
    }
    .integration-card p {
      color: #666;
      margin-bottom: 16px;
    }
    .code-block {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 12px;
      margin: 12px 0;
      overflow-x: auto;
    }
    .code-block pre {
      margin: 0;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
    .info-box {
      background: #e7f3ff;
      border: 1px solid #b3d9ff;
      border-radius: 4px;
      padding: 12px;
      margin-top: 16px;
    }
    .info-box ul {
      margin: 8px 0 0 20px;
      padding: 0;
    }
    .info-box li {
      margin-bottom: 4px;
    }
    .warning-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      padding: 12px;
      margin: 12px 0;
      color: #856404;
    }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
    }
  `],
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
