/**
 * Spectyra Studio (Scenarios v1)
 *
 * Public demo UI for running Raw vs Spectyra side-by-side.
 * Reuses the Optimizer Lab visual pattern (metrics + compare panes).
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { StudioService, StudioRunResult, StudioRunRequest } from './studio.service';
import { STUDIO_SCENARIOS, StudioScenarioDef, StudioScenarioId } from './studio-scenarios.registry';
import { SnackbarService } from '../../core/services/snackbar.service';

type ResultTab = 'metrics' | 'before' | 'after' | 'diff';
type StudioRunMode = 'scenario' | 'live';
type SpectyraRunMode = 'off' | 'observe' | 'on';

interface StudioAdvancedOptions {
  showToolCalls: boolean;
  showPolicyEvaluation: boolean;
  showTokenBreakdown: boolean;
  showMoreScenarios: boolean;
  /**
   * When true, Studio will make real provider calls (incurs token cost)
   * and report real usage. When false, Studio uses dry-run estimates.
   */
  liveProviderRun: boolean;
  /** Provider to use for live runs (requires BYOK/vaulted key). */
  provider: 'anthropic' | 'openai';
  /** Model name for provider. */
  model: string;
  /** Optimization level (0-4). */
  optimizationLevel: number;
  /**
   * Optional BYOK provider key for live runs.
   * Sent via `X-PROVIDER-KEY` header (never stored).
   */
  byokProviderKey?: string;
  // Scenario-specific optional knobs
  rules?: string;
}

@Component({
  selector: 'app-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './studio.page.html',
  styleUrls: ['./studio.page.scss'],
})
export class StudioPage implements OnInit {
  // Loading state (Studio itself is public)
  loading = true;
  error: string | null = null;

  // Scenario
  private featuredScenarios: StudioScenarioDef[] = STUDIO_SCENARIOS.filter((s) =>
    s.id === 'token_chat' ||
    s.id === 'token_code' ||
    s.id === 'agent_claude' ||
    s.id === 'openclaw_local'
  );
  scenarios: StudioScenarioDef[] = this.featuredScenarios;
  scenarioId: StudioScenarioId = this.featuredScenarios[0]?.id ?? 'token_chat';
  get selectedScenario(): StudioScenarioDef {
    return this.scenarios.find((s) => s.id === this.scenarioId) ?? this.scenarios[0]!;
  }

  // Inputs (minimal by default)
  primary = '';
  secondary = '';
  showAdvanced = false;
  runMode: StudioRunMode = 'scenario';
  spectyraMode: SpectyraRunMode = 'observe';
  advanced: StudioAdvancedOptions = {
    showToolCalls: false,
    showPolicyEvaluation: false,
    showTokenBreakdown: true,
    showMoreScenarios: false,
    liveProviderRun: false,
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-latest',
    optimizationLevel: 2,
    byokProviderKey: '',
  };

  // Results
  running = false;
  result: StudioRunResult | null = null;
  runHistory: StudioRunResult[] = [];
  activeTab: ResultTab = 'metrics';

  /** Prompt / message tokens billed on the input side (before optimization). */
  get inputTokensBefore(): number {
    return this.result?.raw?.tokens?.input ?? 0;
  }

  /** Prompt / message tokens after Spectyra optimization. */
  get inputTokensAfter(): number {
    return this.result?.spectyra?.tokens?.input ?? 0;
  }

  /** Estimated completion tokens (raw path). */
  get outputTokensBefore(): number {
    return this.result?.raw?.tokens?.output ?? 0;
  }

  /** Estimated completion tokens (Spectyra path). */
  get outputTokensAfter(): number {
    return this.result?.spectyra?.tokens?.output ?? 0;
  }

  get totalTokensBefore(): number {
    return this.result?.raw?.tokens?.total ?? 0;
  }

  get totalTokensAfter(): number {
    return this.result?.spectyra?.tokens?.total ?? 0;
  }

  /** Positive means tokens increased (no savings). */
  get inputTokensDelta(): number {
    return this.inputTokensAfter - this.inputTokensBefore;
  }

  /** Shown in hero: prefer total-based % when prompt tokens are unchanged but total still drops (completion estimate). */
  get displaySavingsPct(): number {
    const m = this.result?.metrics;
    const promptPct = m?.tokenSavingsPct;
    const inputSaved = m?.inputTokensSaved ?? 0;
    const totalSaved = m?.totalTokensSaved ?? 0;
    const rawT = this.totalTokensBefore;
    const specT = this.totalTokensAfter;
    if (rawT > 0 && totalSaved > 0 && inputSaved === 0) {
      return Math.round(((rawT - specT) / rawT) * 10000) / 100;
    }
    if (typeof promptPct === 'number' && !isNaN(promptPct)) return promptPct;
    return 0;
  }

  get displaySavingsHeroLabel(): string {
    const m = this.result?.metrics;
    const inputSaved = m?.inputTokensSaved ?? 0;
    const totalSaved = m?.totalTokensSaved ?? 0;
    if (!this.result) return 'Token savings';
    if (this.result.meta?.reverted) return 'Reverted (optimized larger)';
    if (totalSaved > 0 && inputSaved === 0) {
      return 'Total token reduction (prompt unchanged; savings from total bill estimate)';
    }
    if (!this.hasSavings && this.tokensAdded > 0) return 'No savings (optimized larger)';
    return 'Prompt (input) token savings';
  }

  get tokensBeforeAfterLabel(): string {
    return `${this.inputTokensBefore} → ${this.inputTokensAfter}`;
  }

  /** Prompt-side tokens saved (input). */
  get tokensSaved(): number {
    const saved = this.result?.metrics?.inputTokensSaved;
    return typeof saved === 'number' && !isNaN(saved) ? Math.max(0, saved) : 0;
  }

  /** Total tokens saved (prompt + completion estimate). */
  get totalTokensSaved(): number {
    const saved = this.result?.metrics?.totalTokensSaved;
    return typeof saved === 'number' && !isNaN(saved) ? Math.max(0, saved) : 0;
  }

  get tokensAdded(): number {
    const d = this.inputTokensDelta;
    return d > 0 ? d : 0;
  }

  get totalTokensDelta(): number {
    return this.totalTokensAfter - this.totalTokensBefore;
  }

  get totalTokensAdded(): number {
    const d = this.totalTokensDelta;
    return d > 0 ? d : 0;
  }

  get hasSavings(): boolean {
    return this.tokensSaved > 0 || this.totalTokensSaved > 0;
  }

  get costBeforeUsd(): number {
    return this.result?.raw?.costUsd ?? 0;
  }

  get costAfterUsd(): number {
    return this.result?.spectyra?.costUsd ?? 0;
  }

  /** Positive means cost increased (no savings). */
  get costDeltaUsd(): number {
    return this.costAfterUsd - this.costBeforeUsd;
  }

  get costDeltaPct(): number {
    const before = this.costBeforeUsd;
    if (!before || before <= 0) return 0;
    return (this.costDeltaUsd / before) * 100;
  }

  get hasCostSavings(): boolean {
    return this.costAfterUsd > 0 && this.costBeforeUsd > 0 && this.costDeltaUsd < 0;
  }

  get costChangeLabel(): string {
    // In dry-run, the cost is estimated, but the delta is still meaningful as an estimate.
    return this.hasCostSavings ? 'Cost saved' : 'Cost added';
  }

  get costChangePctLabel(): string {
    const pct = Math.abs(this.costDeltaPct);
    return `${pct.toFixed(2)}%`;
  }

  get savingsHeroValue(): string {
    const pct = this.displaySavingsPct;
    if (pct == null || typeof pct !== 'number' || isNaN(pct)) return '—';
    const clamped = Math.max(0, pct);
    if (clamped > 0) return `${clamped.toFixed(1)}%`;
    return '0%';
  }

  get savingsHeroLabel(): string {
    return this.displaySavingsHeroLabel;
  }

  flowRecommendationLabel(fs: { recommendation: string }): string {
    switch (fs.recommendation) {
      case 'REUSE':
        return 'Reuse / compress — context looks stable';
      case 'EXPAND':
        return 'Expand — add or refine context';
      case 'ASK_CLARIFY':
        return 'Ask to clarify — contradictions or ambiguity';
      default:
        return fs.recommendation;
    }
  }

  constructor(
    private studio: StudioService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit() {
    this.applyDefaults();
    this.loading = false;
  }

  applyDefaults() {
    const def = this.selectedScenario;
    this.primary = def.defaultInputs.primary ?? '';
    this.secondary = def.defaultInputs.secondary ?? '';
    const adv = (def.defaultInputs.advanced ?? {}) as Partial<StudioAdvancedOptions>;
    this.advanced = { ...this.advanced, ...adv };
    // Default mode is scenario unless the preset explicitly opts into live.
    this.runMode = this.advanced.liveProviderRun ? 'live' : 'scenario';
  }

  onRunModeChange() {
    // Single source of truth for backend: advanced.liveProviderRun
    this.advanced.liveProviderRun = this.runMode === 'live';
  }

  private defaultModelForProvider(provider: 'anthropic' | 'openai'): string {
    return provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-latest';
  }

  onProviderChange() {
    // If the user hasn't customized the model (or it's still the other provider's default),
    // snap the model to the right default.
    const current = (this.advanced.model ?? '').trim();
    const nextDefault = this.defaultModelForProvider(this.advanced.provider);
    const otherDefault = this.defaultModelForProvider(this.advanced.provider === 'openai' ? 'anthropic' : 'openai');

    if (!current || current === otherDefault) {
      this.advanced.model = nextDefault;
    }
  }

  copyRunAsFixture() {
    if (!this.result) return;
    const fixture = {
      capturedAt: new Date().toISOString(),
      scenarioId: this.scenarioId,
      mode: this.result.meta?.estimated ? 'scenario_dry_run' : 'live_dual_call',
      inputs: {
        primary: this.primary,
        secondary: this.selectedScenario.inputSchema.secondaryLabel ? this.secondary : undefined,
        advanced: {
          ...this.advanced,
          // Never include raw provider keys in fixtures
          byokProviderKey: undefined,
        },
      },
      raw: {
        promptText: this.result.raw.promptText,
        tokens: this.result.raw.tokens,
        latencyMs: this.result.raw.latencyMs,
        costUsd: this.result.raw.costUsd,
      },
      spectyra: {
        promptText: this.result.spectyra.promptText,
        tokens: this.result.spectyra.tokens,
        latencyMs: this.result.spectyra.latencyMs,
        costUsd: this.result.spectyra.costUsd,
      },
      metrics: this.result.metrics,
      appliedTransforms: this.result.appliedTransforms ?? [],
      meta: this.result.meta ?? {},
    };
    this.copyToClipboard(JSON.stringify(fixture, null, 2));
  }

  onScenarioChange() {
    this.result = null;
    this.applyDefaults();
  }

  onShowMoreScenariosChange() {
    const next = this.advanced.showMoreScenarios ? STUDIO_SCENARIOS : this.featuredScenarios;
    this.scenarios = next;
    // If current scenario is no longer visible, snap back to the first featured scenario.
    const stillExists = this.scenarios.some((s) => s.id === this.scenarioId);
    if (!stillExists) {
      this.scenarioId = this.scenarios[0]?.id ?? 'token_chat';
    }
    this.onScenarioChange();
  }

  useExample() {
    this.applyDefaults();
    this.snackbar.showSuccess('Loaded example inputs');
  }

  restoreFromHistory(run: StudioRunResult) {
    this.result = run;
    this.activeTab = 'metrics';
    this.snackbar.showSuccess('Restored previous run');
  }

  switchTab(tab: ResultTab) {
    this.activeTab = tab;
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => this.snackbar.showSuccess('Copied to clipboard'),
      () => this.snackbar.showError('Failed to copy')
    );
  }

  runRawVsSpectyra() {
    if (!this.primary.trim()) {
      this.snackbar.showError('Please enter the primary input');
      return;
    }
    this.running = true;
    this.result = null;

    const req: StudioRunRequest = {
      scenarioId: this.scenarioId,
      mode: 'raw_vs_spectyra',
      inputs: {
        primary: this.primary,
        secondary: this.selectedScenario.inputSchema.secondaryLabel ? this.secondary : undefined,
        advanced: this.advanced,
      },
    };

    const byokKey = (this.advanced.byokProviderKey ?? '').trim();
    this.studio.runScenario(req, byokKey || undefined).subscribe({
      next: (res) => {
        this.result = res;
        this.activeTab = 'metrics';
        this.runHistory = [res, ...this.runHistory].slice(0, 5);
        this.running = false;
      },
      error: (err) => {
        this.running = false;
        const msg = err?.error?.error || err?.error?.message || 'Failed to run scenario';
        this.snackbar.showError(String(msg));
      },
    });
  }
}

