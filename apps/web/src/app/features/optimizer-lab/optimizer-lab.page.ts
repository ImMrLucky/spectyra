/**
 * Optimizer Lab Page
 * 
 * Admin tool for testing the optimization pipeline and running customer demos.
 * Shows before/after comparison, token savings, and trust indicators.
 * 
 * Security:
 * - Owner/admin only access
 * - Server-enforced view mode and redaction
 * - No raw prompt storage
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OptimizerLabService,
  OptimizeLabRequest,
  OptimizeLabResponse,
  DemoType,
  OptimizationLevel,
  ViewMode,
  ChatMessage,
} from '../../core/api/optimizer-lab.service';
import { SupabaseService } from '../../services/supabase.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { CHAT_DEMO_PRESET, CODE_DEMO_PRESET, DemoPreset } from './presets';

type ResultTab = 'before' | 'after' | 'diff' | 'metrics' | 'trust' | 'debug';

@Component({
  selector: 'app-optimizer-lab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './optimizer-lab.page.html',
  styleUrls: ['./optimizer-lab.page.scss'],
})
export class OptimizerLabPage implements OnInit {
  // Auth state
  isOwner = false;
  isAuthenticated = false;
  loading = true;
  error: string | null = null;

  // Input state
  demoType: DemoType = 'chat';
  optimizationLevel: OptimizationLevel = 'balanced';
  prompt = '';
  repoContext = '';
  includeDebug = true;
  viewMode: ViewMode = 'ADMIN_DEBUG';

  // Advanced options (collapsed by default)
  showAdvancedOptions = false;
  advancedMessages: string = '';
  keepLastTurns: number | null = null;
  maxRefs: number | null = null;

  // Results state
  result: OptimizeLabResponse | null = null;
  running = false;
  activeTab: ResultTab = 'metrics';

  // Presets
  presets = {
    chat: CHAT_DEMO_PRESET,
    code: CODE_DEMO_PRESET,
  };

  constructor(
    private optimizerLab: OptimizerLabService,
    private supabase: SupabaseService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit() {
    this.supabase.getSession().subscribe((session) => {
      this.isAuthenticated = !!session;
      if (session) {
        this.checkAccess();
      } else {
        this.loading = false;
        this.error = 'Please log in to access the Optimizer Lab';
      }
    });
  }

  checkAccess() {
    // Try health check to verify access
    this.optimizerLab.checkHealth().subscribe({
      next: () => {
        this.isOwner = true;
        this.loading = false;
        this.error = null;
      },
      error: (err) => {
        this.isOwner = false;
        this.loading = false;
        if (err.status === 403) {
          this.error = 'Access denied: Admin only';
        } else if (err.status === 401) {
          this.error = 'Please log in to access the Optimizer Lab';
        } else {
          this.error = err.error?.error || 'Failed to access Optimizer Lab';
        }
      },
    });
  }

  loadPreset(type: 'chat' | 'code') {
    const preset = this.presets[type];
    this.demoType = preset.demoType;
    this.prompt = preset.prompt;
    this.repoContext = preset.repoContext || '';
    this.optimizationLevel = preset.optimizationLevel || 'balanced';
    this.snackbar.showSuccess(`Loaded ${type} demo preset`);
  }

  runOptimization() {
    if (!this.prompt.trim() && !this.advancedMessages.trim()) {
      this.snackbar.showError('Please enter a prompt or messages');
      return;
    }

    this.running = true;
    this.error = null;
    this.result = null;

    // Build request
    const request: OptimizeLabRequest = {
      demoType: this.demoType,
      optimizationLevel: this.optimizationLevel,
      debug: this.includeDebug,
      requestedViewMode: this.viewMode,
    };

    // Use advanced messages if provided, otherwise use prompt
    if (this.advancedMessages.trim()) {
      try {
        request.messages = JSON.parse(this.advancedMessages);
      } catch (e) {
        this.snackbar.showError('Invalid JSON in advanced messages');
        this.running = false;
        return;
      }
    } else {
      request.prompt = this.prompt;
    }

    // Add repo context for code demos
    if (this.demoType === 'code' && this.repoContext.trim()) {
      request.repoContext = this.repoContext;
    }

    // Add advanced options if set
    if (this.keepLastTurns || this.maxRefs) {
      request.options = {};
      if (this.keepLastTurns) request.options.keepLastTurns = this.keepLastTurns;
      if (this.maxRefs) request.options.maxRefs = this.maxRefs;
    }

    this.optimizerLab.runOptimization(request).subscribe({
      next: (response) => {
        this.result = response;
        this.running = false;
        this.activeTab = 'metrics';
        this.snackbar.showSuccess(
          `Optimization complete: ${response.diff.summary.pctSaved.toFixed(1)}% tokens saved`
        );
      },
      error: (err) => {
        this.running = false;
        this.error = err.error?.message || err.error?.error || 'Optimization failed';
        this.snackbar.showError(this.error || 'Optimization failed');
      },
    });
  }

  switchTab(tab: ResultTab) {
    this.activeTab = tab;
  }

  // Helper methods for template

  getRenderedText(data: string | { redacted: true; type: string; summary: string }): string {
    if (typeof data === 'string') {
      return data;
    }
    return data.summary;
  }

  isRedacted(data: any): boolean {
    return typeof data === 'object' && data?.redacted === true;
  }

  getMessages(data: ChatMessage[] | { redacted: true }): ChatMessage[] {
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }

  formatCost(usd: number): string {
    if (usd < 0.01) {
      return `$${usd.toFixed(4)}`;
    }
    return `$${usd.toFixed(2)}`;
  }

  formatNumber(n: number): string {
    return n.toLocaleString();
  }

  formatPercent(n: number): string {
    return `${n.toFixed(1)}%`;
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => this.snackbar.showSuccess('Copied to clipboard'),
      () => this.snackbar.showError('Failed to copy')
    );
  }

  exportRedactedReport() {
    if (!this.result) return;

    const report = this.generateMarkdownReport();
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimizer-lab-report-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.snackbar.showSuccess('Report exported');
  }

  private generateMarkdownReport(): string {
    if (!this.result) return '';

    const r = this.result;
    const lines: string[] = [
      '# Spectyra Optimizer Lab Report',
      '',
      `**Generated:** ${new Date().toLocaleString()}`,
      `**Demo Type:** ${r.meta.demoType}`,
      `**Optimization Level:** ${r.meta.optimizationLevel}`,
      `**Latency:** ${r.meta.latencyMs}ms`,
      '',
      '## Token Savings',
      '',
      '| Metric | Before | After | Saved |',
      '|--------|--------|-------|-------|',
      `| Input Tokens | ${this.formatNumber(r.diff.summary.inputTokensBefore)} | ${this.formatNumber(r.diff.summary.inputTokensAfter)} | ${this.formatPercent(r.diff.summary.pctSaved)} |`,
      `| Est. Cost | ${this.formatCost(r.original.tokenEstimate.estimatedCostUsd)} | ${this.formatCost(r.optimized.tokenEstimate.estimatedCostUsd)} | ${this.formatCost(r.original.tokenEstimate.estimatedCostUsd - r.optimized.tokenEstimate.estimatedCostUsd)} |`,
      '',
      '## Applied Transforms',
      '',
      ...r.diff.appliedTransforms.map((t) => `- ${t}`),
      '',
      '## Trust & Safety',
      '',
      '### Preserved (Unchanged)',
      ...r.diff.safetySummary.preserved.map((p) => `- ✅ ${p}`),
      '',
      '### Changed (Optimized)',
      ...r.diff.safetySummary.changed.map((c) => `- 🔄 ${c}`),
      '',
      '### Risk Notes',
      ...r.diff.safetySummary.riskNotes.map((n) => `- ℹ️ ${n}`),
      '',
      '---',
      '*This report was generated by Spectyra Optimizer Lab.*',
      '*No raw prompts or code are included for IP protection.*',
    ];

    return lines.join('\n');
  }

  clearResults() {
    this.result = null;
    this.error = null;
  }
}
