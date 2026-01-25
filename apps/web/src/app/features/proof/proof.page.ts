import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { formatCurrency, formatPercent, formatNumber } from '../../core/util/format';

interface ProofEstimate {
  baseline_estimate: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  };
  optimized_estimate: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  };
  savings: {
    tokens_saved: number;
    pct_saved: number;
    cost_saved_usd: number;
  };
  confidence_band: string;
  explanation_summary: string;
}

@Component({
  selector: 'app-proof',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h1>Proof Mode - Estimate Savings</h1>
      <p class="subtitle">Paste a conversation to see estimated token and cost savings without making real LLM calls.</p>
      
      <div class="card">
        <h3>Configuration</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Path</label>
            <select class="form-select" [(ngModel)]="path">
              <option value="talk">Talk</option>
              <option value="code">Code</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Provider</label>
            <select class="form-select" [(ngModel)]="provider">
              <option *ngFor="let p of providers" [value]="p.name">{{ p.name }}</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Model</label>
            <select class="form-select" [(ngModel)]="model">
              <option *ngFor="let m of availableModels" [value]="m">{{ m }}</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Optimization Level: {{ optimizationLevel }}</label>
            <input 
              type="range" 
              min="0" 
              max="4" 
              [(ngModel)]="optimizationLevel"
              class="slider">
            <div class="slider-labels">
              <span>Minimal</span>
              <span>Conservative</span>
              <span>Balanced</span>
              <span>Aggressive</span>
              <span>Maximum</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h3>Paste Conversation</h3>
        <p class="help-text">Paste a conversation from ChatGPT, Claude, or any chat interface. You can paste the raw text or JSON format.</p>
        <textarea 
          class="textarea"
          [(ngModel)]="conversationInput"
          placeholder="Paste your conversation here... (supports plain text or JSON format)"
          rows="12">
        </textarea>
        <button 
          class="btn btn-primary"
          (click)="estimateSavings()"
          [disabled]="loading || !conversationInput.trim()">
          {{ loading ? 'Estimating...' : 'Estimate Savings' }}
        </button>
      </div>
      
      <div *ngIf="parsedMessages && parsedMessages.length > 0" class="card conversation-preview">
        <h3>Conversation Preview</h3>
        <div class="conversation-messages">
          <div *ngFor="let msg of parsedMessages; let i = index" class="message" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
            <div class="message-role">{{ msg.role === 'user' ? 'You' : 'Assistant' }}</div>
            <div class="message-content">{{ msg.content }}</div>
          </div>
        </div>
      </div>
      
      <div *ngIf="estimate && !loading" class="results">
        <div class="card savings-card">
          <h3>Savings Summary</h3>
          <div class="savings-grid">
            <div class="savings-item">
              <div class="savings-label">Tokens Saved</div>
              <div class="savings-value">{{ formatNumber(estimate.savings.tokens_saved) }}</div>
              <div class="savings-pct">{{ formatPercent(estimate.savings.pct_saved) }} saved</div>
            </div>
            
            <div class="savings-item">
              <div class="savings-label">Cost Saved</div>
              <div class="savings-value">{{ formatCurrency(estimate.savings.cost_saved_usd) }}</div>
              <div class="savings-pct">{{ formatPercent(estimate.savings.pct_saved) }} saved</div>
            </div>
            
            <div class="savings-item">
              <div class="savings-label">Confidence</div>
              <div class="savings-value confidence" [class.confidence-high]="estimate.confidence_band === 'high'"
                   [class.confidence-medium]="estimate.confidence_band === 'medium'"
                   [class.confidence-low]="estimate.confidence_band === 'low'">
                {{ estimate.confidence_band }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <h3>Baseline Estimate</h3>
          <div class="estimate-details">
            <div>Input: {{ formatNumber(estimate.baseline_estimate.input_tokens) }} tokens</div>
            <div>Output: {{ formatNumber(estimate.baseline_estimate.output_tokens) }} tokens</div>
            <div>Total: {{ formatNumber(estimate.baseline_estimate.total_tokens) }} tokens</div>
            <div>Cost: {{ formatCurrency(estimate.baseline_estimate.cost_usd) }}</div>
          </div>
        </div>
        
        <div class="card">
          <h3>Optimized Estimate</h3>
          <div class="estimate-details">
            <div>Input: {{ formatNumber(estimate.optimized_estimate.input_tokens) }} tokens</div>
            <div>Output: {{ formatNumber(estimate.optimized_estimate.output_tokens) }} tokens</div>
            <div>Total: {{ formatNumber(estimate.optimized_estimate.total_tokens) }} tokens</div>
            <div>Cost: {{ formatCurrency(estimate.optimized_estimate.cost_usd) }}</div>
          </div>
        </div>
        
        <div class="card">
          <h3>Optimization Applied</h3>
          <p>{{ estimate.explanation_summary }}</p>
        </div>
      </div>
      
      <div *ngIf="error" class="card error">
        <h3>Error</h3>
        <p>{{ error }}</p>
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
      margin-bottom: 30px;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
    }
    .form-label {
      font-weight: 600;
      margin-bottom: 5px;
      font-size: 14px;
    }
    .form-select {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .slider {
      width: 100%;
      margin: 10px 0;
    }
    .slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #666;
    }
    .help-text {
      color: #666;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      margin-bottom: 15px;
      resize: vertical;
    }
    .conversation-preview {
      margin-top: 20px;
    }
    .conversation-messages {
      max-height: 400px;
      overflow-y: auto;
    }
    .message {
      margin-bottom: 16px;
      padding: 12px;
      border-radius: 6px;
      border-left: 4px solid #ddd;
    }
    .message.user {
      background: #f0f7ff;
      border-left-color: #007bff;
    }
    .message.assistant {
      background: #f8f9fa;
      border-left-color: #6c757d;
    }
    .message-role {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 6px;
    }
    .message-content {
      color: #333;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-primary {
      background: #007bff;
      color: white;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .savings-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    .savings-item {
      text-align: center;
    }
    .savings-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }
    .savings-value {
      font-size: 32px;
      font-weight: 600;
      color: #007bff;
      margin-bottom: 4px;
    }
    .savings-pct {
      font-size: 14px;
      color: #28a745;
    }
    .confidence {
      text-transform: capitalize;
      padding: 4px 12px;
      border-radius: 4px;
      display: inline-block;
    }
    .confidence-high {
      background: #d4edda;
      color: #155724;
    }
    .confidence-medium {
      background: #fff3cd;
      color: #856404;
    }
    .confidence-low {
      background: #f8d7da;
      color: #721c24;
    }
    .estimate-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .error {
      background: #f8d7da;
      color: #721c24;
    }
  `],
})
export class ProofPage {
  path: 'talk' | 'code' = 'talk';
  provider = 'openai';
  model = 'gpt-4o-mini';
  optimizationLevel = 2;
  conversationInput = '';
  parsedMessages: any[] = [];
  estimate: ProofEstimate | null = null;
  loading = false;
  error: string | null = null;
  providers: any[] = [];
  
  constructor(private api: ApiClientService) {
    this.loadProviders();
  }
  
  loadProviders() {
    this.api.getProviders().subscribe({
      next: providers => {
        this.providers = providers;
        if (providers.length > 0) {
          this.provider = providers[0].name;
          this.model = providers[0].models[0] || 'gpt-4o-mini';
        }
      },
      error: err => console.error('Failed to load providers:', err),
    });
  }
  
  get availableModels(): string[] {
    const provider = this.providers.find(p => p.name === this.provider);
    return provider?.models || [];
  }
  
  estimateSavings() {
    if (!this.conversationInput.trim()) {
      this.error = 'Please paste a conversation';
      return;
    }
    
    let messages: any[];
    try {
      // Try to parse as JSON first
      const trimmed = this.conversationInput.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        messages = JSON.parse(trimmed);
        if (!Array.isArray(messages)) {
          throw new Error('JSON must be an array of messages');
        }
      } else {
        // Parse as plain text conversation
        messages = this.parsePlainTextConversation(trimmed);
      }
      
      // Validate messages format
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('No valid messages found');
      }
      
      // Ensure messages have required fields
      messages = messages.map(msg => ({
        role: msg.role || 'user',
        content: msg.content || String(msg)
      }));
      
      this.parsedMessages = messages;
    } catch (err: any) {
      this.error = `Failed to parse conversation: ${err.message}`;
      this.parsedMessages = [];
      return;
    }
    
    this.loading = true;
    this.error = null;
    this.estimate = null;
    
    this.api.proofEstimate({
      path: this.path,
      provider: this.provider,
      model: this.model,
      optimization_level: this.optimizationLevel,
      messages,
    }).subscribe({
      next: estimate => {
        this.estimate = estimate;
        this.loading = false;
      },
      error: err => {
        this.error = err.error?.error || 'Failed to estimate savings';
        this.loading = false;
      },
    });
  }
  
  /**
   * Parse plain text conversation into message format
   * Handles common formats like:
   * - "User: ...\nAssistant: ..."
   * - "Human: ...\nAI: ..."
   * - Lines starting with "You:" or "ChatGPT:"
   */
  parsePlainTextConversation(text: string): any[] {
    const messages: any[] = [];
    const lines = text.split('\n');
    let currentRole: 'user' | 'assistant' = 'user';
    let currentContent: string[] = [];
    
    const rolePatterns = [
      { pattern: /^(user|you|human|human:)/i, role: 'user' as const },
      { pattern: /^(assistant|ai|chatgpt|claude|gpt|bot|assistant:)/i, role: 'assistant' as const },
    ];
    
    for (const line of lines) {
      let matched = false;
      for (const { pattern, role } of rolePatterns) {
        if (pattern.test(line)) {
          // Save previous message
          if (currentContent.length > 0) {
            messages.push({
              role: currentRole,
              content: currentContent.join('\n').trim()
            });
          }
          // Start new message
          currentRole = role;
          currentContent = [line.replace(pattern, '').trim()];
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        if (currentContent.length === 0 && line.trim()) {
          // First line without role marker - assume user
          currentRole = 'user';
        }
        currentContent.push(line);
      }
    }
    
    // Add last message
    if (currentContent.length > 0) {
      messages.push({
        role: currentRole,
        content: currentContent.join('\n').trim()
      });
    }
    
    return messages;
  }
  
  formatCurrency = formatCurrency;
  formatPercent = formatPercent;
  formatNumber = formatNumber;
}
