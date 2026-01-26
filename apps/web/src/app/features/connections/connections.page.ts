import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container">
      <h1>Connect Your Coding Tools</h1>
      <p class="subtitle">Set up Spectyra Proxy to optimize Claude Code, Cursor, Copilot, and other coding assistants</p>
      
      <div class="info-box">
        <h3>📋 How It Works</h3>
        <p>Desktop coding tools (Copilot, Cursor, Claude Code) connect via the <strong>Local Proxy</strong>, not the web UI.</p>
        <p>The web UI is for managing scenarios and viewing savings. The proxy runs separately on your machine.</p>
      </div>
      
      <div class="steps">
        <div class="step-card">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>Install and Start Proxy</h3>
            <p><strong>Option A: Install via npm (Recommended)</strong></p>
            <p>Open a terminal/command prompt and run:</p>
            <div class="code-block">
              <code>npm install -g &#64;spectyra/proxy</code><br>
              <code>spectyra-proxy</code>
            </div>
            <p class="step-note"><strong>What this does:</strong></p>
            <ul>
              <li><code>npm install -g &#64;spectyra/proxy</code> - Installs the proxy globally (first time only)</li>
              <li><code>spectyra-proxy</code> - Starts the proxy server</li>
            </ul>
            <p class="step-note" style="color: #155724; background: #d4edda; padding: 8px; border-radius: 4px; margin-top: 8px;">
              <strong>✅ Safe:</strong> The npm package contains only compiled code, not source code. Your code stays private.
            </p>
            
            <p style="margin-top: 20px;"><strong>Option B: Install from GitHub (If npm package not available)</strong></p>
            <p>If the npm package isn't published yet, you can download from GitHub:</p>
            <div class="code-block">
              <code># Download the proxy</code><br>
              <code>git clone https://github.com/your-repo/spectyra.git</code><br>
              <code>cd spectyra/tools/proxy</code><br>
              <code>npm install</code><br>
              <code>npm start</code>
            </div>
            <p class="step-note" style="margin-top: 8px;">
              <strong>Note:</strong> You'll need Node.js installed. Download from <a href="https://nodejs.org" target="_blank">nodejs.org</a> if needed.
            </p>
            <p class="step-note" style="color: #856404; background: #fff3cd; padding: 8px; border-radius: 4px; margin-top: 8px;">
              <strong>🔒 Privacy:</strong> The published npm package contains only compiled code, not source code. Your code remains private.
            </p>
            
            <p class="step-note"><strong>After starting, the proxy will be available at:</strong></p>
            <ul>
              <li><strong>Proxy Server:</strong> <a href="http://localhost:3001" target="_blank">http://localhost:3001</a> (for your coding tools to connect)</li>
              <li><strong>Dashboard:</strong> <a href="http://localhost:3002" target="_blank">http://localhost:3002</a> (web UI to configure and monitor)</li>
            </ul>
            <p class="step-note" style="color: #856404; background: #fff3cd; padding: 8px; border-radius: 4px; margin-top: 12px;">
              <strong>💡 Tip:</strong> Keep the terminal open while using the proxy. Press Ctrl+C to stop it.
            </p>
          </div>
        </div>
        
        <div class="step-card">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>Configure Proxy</h3>
            <ol>
              <li>Open <a href="http://localhost:3002" target="_blank">http://localhost:3002</a> in your browser</li>
              <li>Go to "Configuration" tab</li>
              <li>Enter your <strong>Spectyra API Key</strong> (from registration)</li>
              <li>Enter your <strong>Provider API Key</strong> (OpenAI, Anthropic, etc.)</li>
              <li>Select provider and optimization settings</li>
              <li>Click "Save Configuration"</li>
            </ol>
          </div>
        </div>
        
        <div class="step-card">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>Configure Your Coding Tool</h3>
            
            <div class="tool-config">
              <h4>GitHub Copilot</h4>
              <p>Set environment variable:</p>
              <div class="code-block">
                <code>export OPENAI_API_BASE=http://localhost:3001/v1</code>
              </div>
              <p>Or in VS Code settings.json:</p>
              <div class="code-block">
                <code>{{ '{' }}</code><br>
                <code>  "github.copilot.advanced": {{ '{' }}</code><br>
                <code>    "api.baseUrl": "http://localhost:3001/v1"</code><br>
                <code>  {{ '}' }}</code><br>
                <code>{{ '}' }}</code>
              </div>
            </div>
            
            <div class="tool-config">
              <h4>Cursor</h4>
              <ol>
                <li>Open Cursor Settings</li>
                <li>Search for "API"</li>
                <li>Set "OpenAI API Base URL" to: <code>http://localhost:3001/v1</code></li>
                <li>Restart Cursor</li>
              </ol>
            </div>
            
            <div class="tool-config">
              <h4>Claude Code</h4>
              <ol>
                <li>Open Claude Code settings</li>
                <li>Set custom API endpoint: <code>http://localhost:3001/v1</code></li>
                <li>Restart Claude Code</li>
              </ol>
            </div>
            
            <div class="tool-config">
              <h4>Codeium / Tabnine</h4>
              <ol>
                <li>Open tool settings</li>
                <li>Set API endpoint: <code>http://localhost:3001/v1</code></li>
                <li>Restart editor</li>
              </ol>
            </div>
          </div>
        </div>
        
        <div class="step-card">
          <div class="step-number">4</div>
          <div class="step-content">
            <h3>Monitor Savings</h3>
            <p>Open the proxy dashboard: <a href="http://localhost:3002" target="_blank">http://localhost:3002</a></p>
            <p>You'll see:</p>
            <ul>
              <li>Total requests processed</li>
              <li>Total tokens saved</li>
              <li>Total cost saved</li>
              <li>Recent request history</li>
            </ul>
            <p class="step-note">Dashboard updates in real-time as you use your coding tool!</p>
          </div>
        </div>
      </div>
      
      <div class="info-box warning">
        <h3>⚠️ Important Notes</h3>
        <ul>
          <li>The proxy must be running for tools to connect</li>
          <li>Keep the proxy dashboard open to monitor savings</li>
          <li>Proxy runs locally on your machine (not in the cloud)</li>
          <li>Each tool needs to be configured separately</li>
        </ul>
      </div>
      
      <div class="info-box">
        <h3>📚 Documentation</h3>
        <ul>
          <li><a href="https://github.com/your-repo/tools/proxy/README.md" target="_blank">Proxy README</a></li>
          <li><a href="https://github.com/your-repo/tools/proxy/SETUP_GUIDE.md" target="_blank">Detailed Setup Guide</a></li>
          <li><a href="https://github.com/your-repo/tools/proxy/PROVIDER_SUPPORT.md" target="_blank">Provider Support Guide</a></li>
        </ul>
      </div>
      
      <div class="quick-links">
        <a routerLink="/savings" class="btn btn-secondary">View Savings Dashboard</a>
        <a routerLink="/scenarios" class="btn btn-secondary">Back to Scenarios</a>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
    }
    
    h1 {
      font-size: 32px;
      margin-bottom: 8px;
    }
    
    .subtitle {
      color: #666;
      font-size: 16px;
      margin-bottom: 30px;
    }
    
    .info-box {
      background: #e7f3ff;
      border: 1px solid #b3d9ff;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    
    .info-box.warning {
      background: #fff3cd;
      border-color: #ffc107;
    }
    
    .info-box h3 {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 18px;
    }
    
    .info-box ul {
      margin: 12px 0;
      padding-left: 20px;
    }
    
    .info-box li {
      margin-bottom: 8px;
    }
    
    .steps {
      display: flex;
      flex-direction: column;
      gap: 24px;
      margin-bottom: 30px;
    }
    
    .step-card {
      display: flex;
      gap: 20px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .step-number {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      background: #007bff;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 600;
    }
    
    .step-content {
      flex: 1;
    }
    
    .step-content h3 {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 20px;
    }
    
    .step-content h4 {
      margin-top: 20px;
      margin-bottom: 8px;
      font-size: 16px;
      color: #333;
    }
    
    .step-note {
      color: #666;
      font-size: 14px;
      margin-top: 8px;
    }
    
    .step-note strong {
      color: #333;
    }
    
    .code-block {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 12px;
      margin: 12px 0;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      overflow-x: auto;
    }
    
    .code-block code {
      color: #333;
      white-space: pre;
    }
    
    .tool-config {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    
    .tool-config:first-child {
      margin-top: 0;
      padding-top: 0;
      border-top: none;
    }
    
    .tool-config ol,
    .tool-config ul {
      margin: 12px 0;
      padding-left: 20px;
    }
    
    .tool-config li {
      margin-bottom: 8px;
    }
    
    .tool-config code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
    }
    
    .quick-links {
      display: flex;
      gap: 12px;
      margin-top: 30px;
    }
    
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    
    .btn-secondary:hover {
      background: #5a6268;
    }
    
    a {
      color: #007bff;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
  `],
})
export class ConnectionsPage implements OnInit {
  ngOnInit() {
    // Component initialization
  }
}
