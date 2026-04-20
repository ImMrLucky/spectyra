import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiClientService } from '../../core/api/api-client.service';
import { WorkspacePlanContextService, type WorkspacePlanSnapshot } from '../../core/services/workspace-plan-context.service';
import { planMarketingName } from '../../core/plan-labels';

@Component({
  selector: 'app-usage',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './usage.page.html',
  styleUrls: ['./usage.page.scss'],
})
export class UsagePage implements OnInit {
  upgrading = false;
  error: string | null = null;

  constructor(
    private workspacePlan: WorkspacePlanContextService,
    private api: ApiClientService,
  ) {}

  get state$() {
    return this.workspacePlan.state$;
  }

  ngOnInit() {
    this.workspacePlan.refresh();
  }

  planLabel(s: WorkspacePlanSnapshot): string {
    const p = s.entitlement?.['plan'];
    return planMarketingName(p != null ? String(p) : 'free');
  }

  runUsagePercent(s: WorkspacePlanSnapshot): number {
    const ent = s.entitlement;
    if (!ent?.['optimizedRunsLimit']) return 0;
    const used = Number(ent['optimizedRunsUsed']) || 0;
    const lim = Number(ent['optimizedRunsLimit']) || 1;
    return Math.round((used / lim) * 100);
  }

  /** Self-serve checkout only when workspace is on Free Tier (no paid sub, not platform-exempt). */
  showFreeTierUpgrade(s: WorkspacePlanSnapshot): boolean {
    const ent = s.entitlement;
    const bill = s.billingStatus;
    if (!ent) return false;
    if (bill && (bill['org_platform_exempt'] || bill['platform_billing_exempt'])) return false;
    if (bill?.['subscription_active'] === true) return false;
    return String(ent['plan'] ?? 'free') === 'free';
  }

  upgrade() {
    this.upgrading = true;
    this.error = null;
    const successUrl = `${window.location.origin}/billing?upgraded=true`;
    const cancelUrl = `${window.location.origin}/usage`;
    this.api.createCheckout(successUrl, cancelUrl).subscribe({
      next: (data) => {
        if (data.checkout_url) window.location.href = data.checkout_url;
        else {
          this.error = 'Failed to create checkout session';
          this.upgrading = false;
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Checkout failed';
        this.upgrading = false;
      },
    });
  }
}
