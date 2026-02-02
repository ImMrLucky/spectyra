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

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
import { AuthService } from '../../core/auth/auth.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { CHAT_DEMO_PRESET, CODE_DEMO_PRESET } from './presets';
import {
  generateChatMessages,
  generateCodeMessages,
  CHAT_SCENARIO_OPTIONS,
  CODE_SCENARIO_OPTIONS,
} from './generator';

type ResultTab = 'before' | 'after' | 'diff' | 'metrics' | 'trust' | 'debug';

@Component({
  selector: 'app-optimizer-lab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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

  // Generate Test Data
  turnCount = 20;
  seed = 42;
  generatorScenario = CHAT_SCENARIO_OPTIONS[0] ?? '';
  includeSystemMessage = true;
  includeToolTraces = true;
  generatedSummary: string | null = null;

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

  chatScenarioOptions = CHAT_SCENARIO_OPTIONS;
  codeScenarioOptions = CODE_SCENARIO_OPTIONS;

  get generatorScenarioOptions(): string[] {
    return this.demoType === 'chat' ? this.chatScenarioOptions : this.codeScenarioOptions;
  }

  get currentGeneratorScenario(): string {
    const opts = this.generatorScenarioOptions;
    if (opts.includes(this.generatorScenario)) return this.generatorScenario;
    return opts[0] ?? '';
  }

  get parsedMessageCount(): number {
    if (!this.advancedMessages.trim()) return 0;
    try {
      const arr = JSON.parse(this.advancedMessages);
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  }

  get showLowTurnWarning(): boolean {
    const n = this.parsedMessageCount;
    return n > 0 && n < 6;
  }

  constructor(
    private optimizerLab: OptimizerLabService,
    private supabase: SupabaseService,
    private authService: AuthService,
    private snackbar: SnackbarService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Same auth as rest of app: if you have a Supabase session, you're in. No extra login.
    this.supabase.getSession().subscribe(async (session) => {
      if (session) {
        this.isAuthenticated = true;
        this.loading = false;
        this.error = null;
        this.isOwner = true; // Show page; API will enforce owner on first run
        this.verifyAdminInBackground();
        return;
      }
      const token = await this.supabase.getAccessToken();
      if (token) {
        this.isAuthenticated = true;
        this.loading = false;
        this.error = null;
        this.isOwner = true;
        this.verifyAdminInBackground();
        return;
      }
      this.loading = false;
      const hasApiKey = !!this.authService.currentApiKey;
      if (hasApiKey) {
        this.error = 'Optimizer Lab requires signing in with your account (email/password).';
      } else {
        this.error = 'Please log in to access the Optimizer Lab';
      }
    });
  }

  /** Optional background check: if not owner, show Access denied. No extra login. */
  verifyAdminInBackground() {
    this.optimizerLab.checkHealth().subscribe({
      next: () => {
        this.error = null;
      },
      error: (err) => {
        if (err.status === 403) {
          this.isOwner = false;
          this.error = 'Access denied: Admin only. This page is for organization owners.';
        } else if (err.status === 401) {
          this.error = 'Session expired. Please log out and log in again.';
        }
        // Other errors (network etc.): leave page usable, API will fail on Run
      },
    });
  }

  loadPreset(type: 'chat' | 'code') {
    const preset = this.presets[type];
    this.demoType = preset.demoType;
    this.prompt = preset.prompt;
    this.repoContext = preset.repoContext || '';
    this.optimizationLevel = preset.optimizationLevel || 'balanced';
    this.generatedSummary = null;
    this.snackbar.showSuccess(`Loaded ${type} demo preset`);
  }

  randomizeSeed() {
    this.seed = Math.floor(Math.random() * 100000);
    this.cdr.detectChanges();
  }

  generateMessages() {
    const scenario = this.currentGeneratorScenario;
    const params = {
      turns: Math.max(1, Math.min(500, this.turnCount)),
      seed: this.seed,
      scenario,
      includeSystem: this.includeSystemMessage,
      includeTools: this.includeToolTraces,
    };
    const messages =
      this.demoType === 'chat'
        ? generateChatMessages(params)
        : generateCodeMessages(params);
    this.advancedMessages = JSON.stringify(messages, null, 2);
    this.showAdvancedOptions = true;
    const total = messages.length;
    const pairs = messages.filter((m) => m.role === 'user').length;
    this.generatedSummary = `Generated ${pairs} turns (${total} messages) with seed ${this.seed}`;
    this.snackbar.showSuccess(this.generatedSummary);
    this.cdr.detectChanges();
  }

  runOptimization() {
    if (!this.prompt.trim() && !this.advancedMessages.trim()) {
      this.snackbar.showError('Please enter a prompt or messages');
      return;
    }

    this.running = true;
    this.error = null;
    this.result = null;

    const request: OptimizeLabRequest = {
      demoType: this.demoType,
      optimizationLevel: this.optimizationLevel,
      debug: this.includeDebug,
      requestedViewMode: this.viewMode,
    };

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
        const body = response && (response as any).data !== undefined ? (response as any).data : response;
        this.result = this.normalizeResponse(body);
        this.running = false;
        this.activeTab = 'metrics';
        const pct = this.result.diff?.summary?.pctSaved ?? 0;
        this.snackbar.showSuccess(
          `Optimization complete: ${typeof pct === 'number' ? pct.toFixed(1) : pct}% tokens saved`
        );
        this.cdr.detectChanges();
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
    this.cdr.detectChanges();
  }

  /**
   * Normalize API response so UI always gets camelCase and expected shape.
   * Handles both camelCase and snake_case from the API.
   */
  private normalizeResponse(res: any): OptimizeLabResponse {
    const o = res?.original ?? {};
    const opt = res?.optimized ?? {};
    const d = res?.diff ?? {};
    const s = d?.summary ?? {};
    const safety = d?.safetySummary ?? {};
    const meta = res?.meta ?? {};
    const oTe = o?.tokenEstimate ?? o?.token_estimate ?? {};
    const optTe = opt?.tokenEstimate ?? opt?.token_estimate ?? {};
    return {
      viewMode: res?.viewMode ?? res?.view_mode ?? 'DEMO_VIEW',
      original: {
        messages: Array.isArray(o?.messages) ? o.messages : [],
        renderedText: o?.renderedText ?? o?.rendered_text ?? '',
        tokenEstimate: {
          inputTokens: oTe?.inputTokens ?? oTe?.input_tokens ?? 0,
          outputTokens: oTe?.outputTokens ?? oTe?.output_tokens ?? 0,
          totalTokens: oTe?.totalTokens ?? oTe?.total_tokens ?? 0,
          estimatedCostUsd: oTe?.estimatedCostUsd ?? oTe?.estimated_cost_usd ?? 0,
        },
      },
      optimized: {
        messages: Array.isArray(opt?.messages) ? opt.messages : (typeof opt?.messages === 'object' ? opt.messages : []),
        renderedText: typeof opt?.renderedText === 'string' ? opt.renderedText : (opt?.rendered_text ?? ''),
        tokenEstimate: {
          inputTokens: optTe?.inputTokens ?? optTe?.input_tokens ?? 0,
          outputTokens: optTe?.outputTokens ?? optTe?.output_tokens ?? 0,
          totalTokens: optTe?.totalTokens ?? optTe?.total_tokens ?? 0,
          estimatedCostUsd: optTe?.estimatedCostUsd ?? optTe?.estimated_cost_usd ?? 0,
        },
      },
      diff: {
        appliedTransforms: Array.isArray(d?.appliedTransforms) ? d.appliedTransforms : (d?.applied_transforms ?? []),
        summary: {
          inputTokensBefore: s?.inputTokensBefore ?? s?.input_tokens_before ?? 0,
          inputTokensAfter: s?.inputTokensAfter ?? s?.input_tokens_after ?? 0,
          pctSaved: typeof s?.pctSaved === 'number' ? s.pctSaved : (s?.pct_saved ?? 0),
          refsUsed: s?.refsUsed ?? s?.refs_used,
          phrasebookEntries: s?.phrasebookEntries ?? s?.phrasebook_entries,
          codemapSnippetsKept: s?.codemapSnippetsKept ?? s?.codemap_snippets_kept,
          codemapOmittedBlocks: s?.codemapOmittedBlocks ?? s?.codemap_omitted_blocks,
        },
        safetySummary: {
          preserved: Array.isArray(safety?.preserved) ? safety.preserved : [],
          changed: Array.isArray(safety?.changed) ? safety.changed : [],
          riskNotes: Array.isArray(safety?.riskNotes) ? safety.riskNotes : (safety?.risk_notes ?? []),
        },
        unifiedDiff: d?.unifiedDiff ?? d?.unified_diff,
      },
      meta: {
        demoType: meta?.demoType ?? meta?.demo_type ?? 'chat',
        path: meta?.path ?? 'talk',
        optimizationLevel: meta?.optimizationLevel ?? meta?.optimization_level ?? 'balanced',
        latencyMs: meta?.latencyMs ?? meta?.latency_ms ?? 0,
        timestamp: meta?.timestamp ?? new Date().toISOString(),
      },
      debug: res?.debug,
    };
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

  getMessages(data: ChatMessage[] | { redacted: true } | null | undefined): ChatMessage[] {
    if (data == null) return [];
    if (Array.isArray(data)) return data;
    return [];
  }

  formatCost(usd: number): string {
    const n = Number(usd);
    if (isNaN(n)) return '—';
    if (n < 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
  }

  formatNumber(n: number): string {
    const num = Number(n);
    return isNaN(num) ? '—' : num.toLocaleString();
  }

  formatPercent(n: number): string {
    const num = Number(n);
    return isNaN(num) ? '—' : `${num.toFixed(1)}%`;
  }

  /** Format 0-1 value as percentage for debug panel (strict template safe). */
  formatDebugPercent(value: number | null | undefined): string {
    if (value == null || typeof value !== 'number' || isNaN(value)) return '—';
    return `${(value * 100).toFixed(0)}%`;
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
