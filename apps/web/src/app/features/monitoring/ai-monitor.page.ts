import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MeService } from '../../core/services/me.service';
import { ApiClientService } from '../../core/api/api-client.service';
import type { ProjectSummary } from '@spectyra/shared';

interface MonitorRollup {
  days: number;
  total_events: number;
  total_actual_spend_usd: number;
  by_provider: Array<{ provider: string; events: number; tokens: number }>;
}

interface MonitorBatch {
  id: string;
  created_at: string;
  event_count: number;
  events: unknown;
}

@Component({
  selector: 'app-ai-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ai-monitor.page.html',
  styleUrls: ['./ai-monitor.page.scss'],
})
export class AiMonitorPage implements OnInit {
  projects: ProjectSummary[] = [];
  projectId = '';
  days = 30;
  loading = true;
  error: string | null = null;
  rollup: MonitorRollup | null = null;
  batches: MonitorBatch[] = [];
  flatEvents: Array<Record<string, unknown>> = [];

  constructor(
    private route: ActivatedRoute,
    private me: MeService,
    private api: ApiClientService,
  ) {}

  async ngOnInit() {
    const qp = this.route.snapshot.queryParamMap.get('project');
    try {
      const me = await firstValueFrom(this.me.getMe());
      this.projects = me?.projects ?? [];
      if (qp && this.projects.some((p) => p.id === qp)) {
        this.projectId = qp;
      } else if (this.projects.length > 0) {
        this.projectId = this.projects[0]!.id;
      }
    } catch {
      this.error = 'Could not load projects';
    } finally {
      this.loading = false;
    }
    if (this.projectId) {
      await this.refresh();
    }
  }

  async refresh() {
    if (!this.projectId) return;
    this.loading = true;
    this.error = null;
    try {
      const [r, b] = await Promise.all([
        firstValueFrom(this.api.getProjectMonitorRollup(this.projectId, this.days)),
        firstValueFrom(this.api.getProjectMonitorBatches(this.projectId, 20)),
      ]);
      this.rollup = r;
      this.batches = b.batches ?? [];
      this.flatEvents = [];
      for (const batch of this.batches) {
        const ev = batch.events;
        if (Array.isArray(ev)) {
          for (const row of ev) {
            if (row && typeof row === 'object' && !Array.isArray(row)) {
              this.flatEvents.push(row as Record<string, unknown>);
            }
          }
        }
      }
      this.flatEvents = this.flatEvents.slice(-200);
    } catch (e: unknown) {
      const err = e as { status?: number; error?: { error?: string }; message?: string };
      if (err?.status === 404 || err?.status === 500) {
        this.error =
          err?.error?.error ||
          'No monitor batches yet, or the database migration has not run. Ingest events with the SDK (flushMonitorEventsToCloud) using your project-scoped API key.';
      } else {
        this.error = err?.error?.error || err?.message || 'Failed to load AI monitor data';
      }
      this.rollup = null;
      this.batches = [];
      this.flatEvents = [];
    } finally {
      this.loading = false;
    }
  }

  fmtUsd(n: number | undefined | null): string {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
    return v.toFixed(4);
  }

  evStr(ev: Record<string, unknown>, key: string): string {
    const v = ev[key];
    if (v == null) return '—';
    return String(v);
  }
}
