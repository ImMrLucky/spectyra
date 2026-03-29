import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { TrialLicenseUiService } from '../../../core/agent-companion/trial-license-ui.service';

@Component({
  selector: 'app-desktop-security',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <div class="wrap">
      <h1>Security & trust</h1>
      <p class="sub">Local-first defaults — your provider keys, your machine.</p>

      <div class="grid" *ngIf="topline">
        <mat-card class="trust"><h3>Runs locally</h3><p>Companion listens on localhost; inference is direct to your provider.</p></mat-card>
        <mat-card class="trust"><h3>Your provider keys</h3><p>Billing stays on your provider account.</p></mat-card>
        <mat-card class="trust"><h3>Telemetry</h3><p>{{ telemetry }}</p></mat-card>
        <mat-card class="trust"><h3>Optimization</h3><p>{{ topline.optimizationHeadline }}</p></mat-card>
        <mat-card class="trust"><h3>Trial / license</h3><p>{{ topline.trialBadge || '—' }} · {{ topline.metricsPresentation }} savings</p></mat-card>
      </div>
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
        margin: 0 0 8px;
      }
      .sub {
        color: #64748b;
        margin-bottom: 20px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }
      .trust {
        padding: 16px;
      }
      .trust h3 {
        margin: 0 0 8px;
        font-size: 0.95rem;
      }
      .trust p {
        margin: 0;
        font-size: 0.88rem;
        color: #475569;
        line-height: 1.5;
      }
    `,
  ],
})
export class DesktopSecurityPage implements OnInit {
  topline: ReturnType<TrialLicenseUiService['computeTopline']> | null = null;
  telemetry = '—';

  constructor(
    private companion: CompanionAnalyticsService,
    private trialUi: TrialLicenseUiService,
  ) {}

  async ngOnInit() {
    const h = await this.companion.fetchHealth();
    this.topline = this.trialUi.computeTopline(h);
    this.telemetry = String(h?.['telemetryMode'] ?? 'local');
  }
}
