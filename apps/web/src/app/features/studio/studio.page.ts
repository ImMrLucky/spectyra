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
  scenarios: StudioScenarioDef[] = STUDIO_SCENARIOS;
  scenarioId: StudioScenarioId = STUDIO_SCENARIOS[0]?.id ?? 'token_chat';
  get selectedScenario(): StudioScenarioDef {
    return this.scenarios.find((s) => s.id === this.scenarioId) ?? this.scenarios[0]!;
  }

  // Inputs (minimal by default)
  primary = '';
  secondary = '';
  showAdvanced = false;
  advanced: Record<string, any> = {
    showToolCalls: false,
    showPolicyEvaluation: false,
    showTokenBreakdown: true,
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
    this.advanced = { ...this.advanced, ...(def.defaultInputs.advanced ?? {}) };
  }

  onScenarioChange() {
    this.result = null;
    this.applyDefaults();
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
        advanced: this.showAdvanced ? this.advanced : undefined,
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

