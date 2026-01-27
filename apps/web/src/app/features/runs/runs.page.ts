import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface TokenBreakdown {
  refpack?: { before: number; after: number; saved: number };
  phrasebook?: { before: number; after: number; saved: number };
  codemap?: { before: number; after: number; saved: number };
}

interface UnifiedRun {
  id: string;
  type: 'agent' | 'chat';
  source: 'sdk-local' | 'sdk-remote' | 'api';
  model: string;
  budget: number | null;
  status: string;
  start_time: string;
  end_time: string;
  events_count?: number;
  policy_triggers_count?: number;
  // Chat-specific
  tokens?: number;
  cost?: number;
  quality?: boolean;
  mode?: string;
  path?: string;
  // Core Moat v1
  optimizations_applied?: string[];
  token_breakdown?: TokenBreakdown;
  savings?: {
    tokensSaved?: number;
    pctSaved?: number;
    costSavedUsd?: number;
  };
  // Agent-specific
  allowed_tools?: string[];
  permission_mode?: string;
  prompt_meta?: any;
  reasons?: string[];
}

@Component({
  selector: 'app-runs',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './runs.page.html',
  styleUrls: ['./runs.page.scss'],
})
export class RunsPage implements OnInit {
  runs: UnifiedRun[] = [];
  selectedRun: UnifiedRun | null = null;
  loading = false;
  error: string | null = null;
  
  // Filters
  filterType: 'all' | 'agent' | 'chat' = 'all';
  filterSource: 'all' | 'sdk-local' | 'sdk-remote' | 'api' = 'all';
  filterStatus: 'all' | 'completed' | 'failed' | 'running' = 'all';

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    // Check if viewing a specific run detail
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.loadRunDetail(params['id']);
      } else {
        this.loadRuns();
      }
    });
  }

  async loadRuns() {
    this.loading = true;
    this.error = null;

    try {
      const runs = await this.http.get<UnifiedRun[]>(`${environment.apiUrl}/runs?limit=100`).toPromise();
      this.runs = runs || [];
    } catch (err: any) {
      this.error = 'Failed to load runs';
      console.error('Load runs error:', err);
    } finally {
      this.loading = false;
    }
  }

  async loadRunDetail(runId: string) {
    this.loading = true;
    this.error = null;

    try {
      const run = await this.http.get<UnifiedRun>(`${environment.apiUrl}/runs/${runId}`).toPromise();
      this.selectedRun = run || null;
    } catch (err: any) {
      this.error = 'Failed to load run details';
      console.error('Load run detail error:', err);
    } finally {
      this.loading = false;
    }
  }

  get filteredRuns(): UnifiedRun[] {
    return this.runs.filter(run => {
      if (this.filterType !== 'all' && run.type !== this.filterType) return false;
      if (this.filterSource !== 'all' && run.source !== this.filterSource) return false;
      if (this.filterStatus !== 'all' && run.status !== this.filterStatus) return false;
      return true;
    });
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  }

  formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('en-US').format(num);
  }

  getOptimizationLabel(opt: string): string {
    const labels: { [key: string]: string } = {
      refpack: 'RefPack',
      phrasebook: 'PhraseBook',
      codemap: 'CodeMap',
      semantic_cache: 'Semantic Cache',
    };
    return labels[opt] || opt;
  }

  getTotalTokensSaved(run: UnifiedRun): number {
    if (!run.token_breakdown) return 0;
    let total = 0;
    if (run.token_breakdown.refpack) total += run.token_breakdown.refpack.saved;
    if (run.token_breakdown.phrasebook) total += run.token_breakdown.phrasebook.saved;
    if (run.token_breakdown.codemap) total += run.token_breakdown.codemap.saved;
    return total;
  }

  getTokenBreakdownForOpt(run: UnifiedRun, opt: string): { before: number; after: number; saved: number } | null {
    if (!run.token_breakdown) return null;
    if (opt === 'refpack' && run.token_breakdown.refpack) return run.token_breakdown.refpack;
    if (opt === 'phrasebook' && run.token_breakdown.phrasebook) return run.token_breakdown.phrasebook;
    if (opt === 'codemap' && run.token_breakdown.codemap) return run.token_breakdown.codemap;
    return null;
  }

  viewRun(run: UnifiedRun) {
    this.router.navigate(['/runs', run.id]);
  }

  backToList() {
    this.selectedRun = null;
    this.router.navigate(['/runs']);
  }
}
