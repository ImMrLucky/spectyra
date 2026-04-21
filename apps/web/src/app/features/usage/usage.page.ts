import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiClientService } from '../../core/api/api-client.service';
import { WorkspacePlanContextService, type WorkspacePlanSnapshot } from '../../core/services/workspace-plan-context.service';
import { planMarketingName } from '../../core/plan-labels';
import { SAAS_PLAN_CARDS } from '../../core/product.constants';

@Component({
  selector: 'app-usage',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './usage.page.html',
  styleUrls: ['./usage.page.scss'],
})
export class UsagePage implements OnInit, OnDestroy {
  readonly saasPlans = SAAS_PLAN_CARDS;
  /** Match Plan & Billing — re-enable when in-app SDK billing is validated. */
  readonly showStripeSelfServeCheckout = false;
  selectedCheckoutPlan: 'developer_pro' | 'team_pro' = 'developer_pro';
  upgrading = false;
  error: string | null = null;
  private planPickSub?: Subscription;

  constructor(
    private workspacePlan: WorkspacePlanContextService,
    private api: ApiClientService,
  ) {}

  get state$() {
    return this.workspacePlan.state$;
  }

  ngOnInit() {
    this.workspacePlan.refresh();
    this.planPickSub = this.workspacePlan.state$.subscribe((st) => {
      const allowed = st.billingStatus?.['self_serve_plans'] as string[] | undefined;
      if (!allowed?.length) return;
      if (!allowed.includes(this.selectedCheckoutPlan)) {
        this.selectedCheckoutPlan = allowed.includes('developer_pro') ? 'developer_pro' : 'team_pro';
      }
    });
  }

  ngOnDestroy() {
    this.planPickSub?.unsubscribe();
  }

  get selfServePlanCards(): (typeof SAAS_PLAN_CARDS)[number][] {
    return this.saasPlans.filter((p) => p.id === 'developer_pro' || p.id === 'team_pro');
  }

  isCheckoutPlanSelectable(planId: string, s: WorkspacePlanSnapshot): boolean {
    const allowed = s.billingStatus?.['self_serve_plans'] as string[] | undefined;
    if (!allowed?.length) return planId === 'developer_pro';
    return allowed.includes(planId);
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
    this.api.createCheckout(successUrl, cancelUrl, { saas_plan: this.selectedCheckoutPlan }).subscribe({
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
