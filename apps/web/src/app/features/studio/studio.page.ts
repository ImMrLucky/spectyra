/**
 * Spectyra Studio (Scenarios v1)
 *
 * Owner/admin demo UI for running Raw vs Spectyra side-by-side.
 * Reuses the Optimizer Lab visual pattern (metrics + compare panes).
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { StudioService, StudioRunResult, StudioRunRequest } from './studio.service';
import { STUDIO_SCENARIOS, StudioScenarioDef, StudioScenarioId } from './studio-scenarios.registry';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { OwnerService } from '../../core/services/owner.service';
import { SnackbarService } from '../../core/services/snackbar.service';

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
  // Auth
  loading = true;
  isAuthenticated = false;
  isOwner = false;
  error: string | null = null;

  // Scenario
  private featuredScenarios: StudioScenarioDef[] = STUDIO_SCENARIOS.filter((s) =>
    s.id === 'token_chat' || s.id === 'token_code' || s.id === 'agent_claude'
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
  advanced: StudioAdvancedOptions = {
    showToolCalls: false,
    showPolicyEvaluation: false,
    showTokenBreakdown: true,
    showMoreScenarios: false,
    liveProviderRun: false,
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-latest',
    optimizationLevel: 2,
  };

  // Results
  running = false;
  result: StudioRunResult | null = null;
  runHistory: StudioRunResult[] = [];

  constructor(
    private studio: StudioService,
    private supabase: SupabaseService,
    private auth: AuthService,
    private owner: OwnerService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit() {
    this.applyDefaults();
    this.supabase.getSession().subscribe(async (session) => {
      const token = await this.supabase.getAccessToken();
      const hasApiKey = !!this.auth.currentApiKey;
      this.isAuthenticated = !!session || !!token || hasApiKey;
      this.loading = false;
      if (!this.isAuthenticated) {
        this.error = 'Please log in to access Spectyra Studio';
        return;
      }
      this.owner.getIsOwner().subscribe((isOwner) => {
        this.isOwner = isOwner;
        if (!isOwner) {
          this.error = 'Access denied: Admin only. This page is for organization owners.';
        } else {
          this.error = null;
        }
      });
    });
  }

  applyDefaults() {
    const def = this.selectedScenario;
    this.primary = def.defaultInputs.primary ?? '';
    this.secondary = def.defaultInputs.secondary ?? '';
    const adv = (def.defaultInputs.advanced ?? {}) as Partial<StudioAdvancedOptions>;
    this.advanced = { ...this.advanced, ...adv };
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
    this.snackbar.showSuccess('Restored previous run');
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

    this.studio.runScenario(req).subscribe({
      next: (res) => {
        this.result = res;
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

