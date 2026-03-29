import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { TrialLicenseUiService } from '../../../core/agent-companion/trial-license-ui.service';
import type { SessionAnalyticsRecord } from '@spectyra/analytics-core';

@Component({
  selector: 'app-desktop-sessions',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatTableModule, MatButtonModule],
  template: `
    <div class="wrap">
      <header class="hero">
        <h1>Sessions</h1>
        <p class="sub">Active and recent workflow sessions from your Local Companion.</p>
      </header>

      <mat-card class="card" *ngIf="healthTopline">
        <p class="badge-line">
          <span class="chip">{{ healthTopline.optimizationHeadline }}</span>
          <span class="chip" *ngIf="healthTopline.trialBadge">{{ healthTopline.trialBadge }}</span>
          <span class="chip" *ngIf="healthTopline.metricsPresentation === 'projected'">Projected savings</span>
        </p>
      </mat-card>

      <mat-card class="card">
        <mat-card-title>Recent sessions</mat-card-title>
        <table mat-table [dataSource]="sessions" class="tbl" *ngIf="sessions.length">
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef>Session</th>
            <td mat-cell *matCellDef="let s">{{ s.sessionId?.slice(0, 10) }}…</td>
          </ng-container>
          <ng-container matColumnDef="src">
            <th mat-header-cell *matHeaderCellDef>Source</th>
            <td mat-cell *matCellDef="let s">{{ s.integrationType }}</td>
          </ng-container>
          <ng-container matColumnDef="saved">
            <th mat-header-cell *matHeaderCellDef>Est. saved</th>
            <td mat-cell *matCellDef="let s">\${{ s.estimatedWorkflowSavings | number : '1.2-2' }}</td>
          </ng-container>
          <ng-container matColumnDef="steps">
            <th mat-header-cell *matHeaderCellDef>Steps</th>
            <td mat-cell *matCellDef="let s">{{ s.totalSteps }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        <p *ngIf="!sessions.length" class="muted">No sessions yet — use the Live view while traffic runs.</p>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .wrap {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 1.75rem;
      }
      .sub {
        color: #64748b;
        margin-bottom: 20px;
      }
      .card {
        margin-bottom: 16px;
      }
      .tbl {
        width: 100%;
      }
      .muted {
        color: #94a3b8;
      }
      .badge-line {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        font-size: 0.75rem;
        padding: 4px 10px;
        border-radius: 999px;
        background: #f1f5f9;
        color: #475569;
      }
    `,
  ],
})
export class DesktopSessionsPage implements OnInit {
  sessions: SessionAnalyticsRecord[] = [];
  cols = ['id', 'src', 'saved', 'steps'];
  healthTopline: ReturnType<TrialLicenseUiService['computeTopline']> | null = null;

  constructor(
    private companion: CompanionAnalyticsService,
    private trialUi: TrialLicenseUiService,
  ) {}

  async ngOnInit() {
    const h = await this.companion.fetchHealth();
    this.healthTopline = this.trialUi.computeTopline(h);
    this.sessions = await this.companion.fetchSessions(60);
  }
}
