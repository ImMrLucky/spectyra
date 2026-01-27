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
  templateUrl: './proof.page.html',
  styleUrls: ['./proof.page.css'],
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
