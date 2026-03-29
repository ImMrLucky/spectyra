import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import type { SessionAnalyticsRecord } from '@spectyra/analytics-core';

@Component({
  selector: 'app-desktop-history',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <div class="wrap">
      <header class="hero">
        <h1>History</h1>
        <p class="sub">Rollups from local sessions (today / week / month) — same data as cloud analytics when you sync.</p>
      </header>

      <div class="grid">
        <mat-card class="kpi"><h3>Today</h3><p class="num">\${{ roll.today | number : '1.2-2' }}</p><p class="lbl">est. saved</p></mat-card>
        <mat-card class="kpi"><h3>This week</h3><p class="num">\${{ roll.week | number : '1.2-2' }}</p><p class="lbl">est. saved</p></mat-card>
        <mat-card class="kpi"><h3>Sessions</h3><p class="num">{{ sessions.length }}</p><p class="lbl">loaded</p></mat-card>
      </div>

      <mat-card class="note">
        <p>
          Deeper charts and filters will aggregate these session records. Live split dashboard is the hero for real-time
          monitoring.
        </p>
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
      }
      .sub {
        color: #64748b;
        margin-bottom: 20px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
        margin-bottom: 16px;
      }
      .kpi {
        padding: 16px;
      }
      .kpi h3 {
        margin: 0 0 8px;
        font-size: 0.85rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .num {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
        color: #0f172a;
      }
      .lbl {
        margin: 4px 0 0;
        font-size: 0.8rem;
        color: #94a3b8;
      }
      .note {
        padding: 16px;
        color: #475569;
        font-size: 0.9rem;
      }
    `,
  ],
})
export class DesktopHistoryPage implements OnInit {
  sessions: SessionAnalyticsRecord[] = [];
  roll = { today: 0, week: 0 };

  constructor(private companion: CompanionAnalyticsService) {}

  async ngOnInit() {
    this.sessions = await this.companion.fetchSessions(200);
    const now = Date.now();
    const day = 86400000;
    let t = 0,
      w = 0;
    for (const s of this.sessions) {
      const started = Date.parse(s.startedAt);
      if (Number.isNaN(started)) continue;
      const sv = s.estimatedWorkflowSavings ?? 0;
      if (now - started < day) t += sv;
      if (now - started < 7 * day) w += sv;
    }
    this.roll = { today: t, week: w };
  }
}
