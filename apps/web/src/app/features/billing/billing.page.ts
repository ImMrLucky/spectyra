import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { SPECTYRA_MONTHLY_PRICE_LABEL, SPECTYRA_TRIAL_DAYS, SAAS_PLAN_CARDS } from '../../core/product.constants';
import { trialBannerState, type TrialBannerState } from '@spectyra/shared';

interface LicenseKey {
  id: string;
  key_prefix: string;
  device_name: string | null;
  created_at: string;
  last_validated_at: string | null;
  revoked_at: string | null;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billing.page.html',
  styleUrls: ['./billing.page.scss'],
})
export class BillingPage implements OnInit {
  readonly monthlyPriceLabel = SPECTYRA_MONTHLY_PRICE_LABEL;
  readonly trialDays = SPECTYRA_TRIAL_DAYS;
  readonly saasPlans = SAAS_PLAN_CARDS;
  entitlement: any = null;
  billingStatus: any = null;
  licenseKeys: LicenseKey[] = [];
  loading = true;
  error: string | null = null;
  upgrading = false;
  generatingKey = false;
  newDeviceName = '';
  newLicenseKey: string | null = null;

  accountSummary: {
    access_state: string;
    pause_savings_until: string | null;
    owned_subscriptions: Array<{
      org_id: string;
      org_name: string;
      subscription_status: string;
      cancel_at_period_end: boolean | null;
      subscription_current_period_end: string | null;
    }>;
    has_cancellable_subscription: boolean;
  } | null = null;
  accountActionBusy = false;
  deleteConfirmText = '';

  constructor(private api: ApiClientService) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    this.error = null;
    let loaded = 0;
    const done = () => {
      loaded++;
      if (loaded >= 4) this.loading = false;
    };

    this.api.getEntitlement().subscribe({
      next: (data) => {
        this.entitlement = data;
        done();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load entitlement';
        done();
      },
    });

    this.api.getBillingStatus().subscribe({
      next: (data) => {
        this.billingStatus = data;
        done();
      },
      error: () => done(),
    });

    this.api.getLicenseKeys().subscribe({
      next: (data) => {
        this.licenseKeys = data;
        done();
      },
      error: () => done(),
    });

    this.api.getAccountSummary().subscribe({
      next: (data) => {
        this.accountSummary = {
          access_state: data.access_state,
          pause_savings_until: data.pause_savings_until,
          owned_subscriptions: data.owned_subscriptions ?? [],
          has_cancellable_subscription: !!data.has_cancellable_subscription,
        };
        done();
      },
      error: () => done(),
    });
  }

  get daysRemaining(): number {
    if (!this.entitlement?.trialEndsAt) return 0;
    const end = new Date(this.entitlement.trialEndsAt);
    const diff = end.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  get runUsagePercent(): number {
    if (!this.entitlement?.optimizedRunsLimit) return 0;
    return Math.round((this.entitlement.optimizedRunsUsed / this.entitlement.optimizedRunsLimit) * 100);
  }

  get activeKeys(): LicenseKey[] {
    return this.licenseKeys.filter(k => !k.revoked_at);
  }

  get revokedKeys(): LicenseKey[] {
    return this.licenseKeys.filter(k => k.revoked_at);
  }

  get trialBanner(): TrialBannerState | null {
    const b = this.billingStatus as Record<string, unknown> | null;
    if (!b) return null;
    return trialBannerState({
      trialEndsAtIso: b['trial_ends_at'] as string | null | undefined,
      subscriptionStatus: b['subscription_status'] as string | null | undefined,
      subscriptionActive: b['subscription_active'] as boolean | null | undefined,
      platformExempt: !!(b['org_platform_exempt'] || b['platform_billing_exempt']),
      observeOnlySavings: b['observe_only_savings'] === true,
    });
  }

  trialBannerClass(): string {
    const s = this.trialBanner?.severity;
    if (!s || s === 'none') return '';
    return `trial-banner trial-banner--${s}`;
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  upgrade() {
    this.upgrading = true;
    const successUrl = `${window.location.origin}/usage?upgraded=true`;
    const cancelUrl = `${window.location.origin}/usage`;
    this.api.createCheckout(successUrl, cancelUrl).subscribe({
      next: (data) => {
        if (data.checkout_url) window.location.href = data.checkout_url;
        else { this.error = 'Failed to create checkout session'; this.upgrading = false; }
      },
      error: (err) => { this.error = err.error?.message || 'Checkout failed'; this.upgrading = false; },
    });
  }

  generateKey() {
    this.generatingKey = true;
    this.newLicenseKey = null;
    this.api.generateLicenseKey(this.newDeviceName || undefined).subscribe({
      next: (data) => {
        this.newLicenseKey = data.license_key;
        this.newDeviceName = '';
        this.generatingKey = false;
        this.api.getLicenseKeys().subscribe({ next: (keys) => this.licenseKeys = keys });
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to generate license key';
        this.generatingKey = false;
      },
    });
  }

  revokeKey(id: string) {
    if (!confirm('Revoke this license key? The Desktop App / Companion using it will lose access on next validation.')) return;
    this.api.revokeLicenseKey(id).subscribe({
      next: () => {
        this.api.getLicenseKeys().subscribe({ next: (keys) => this.licenseKeys = keys });
      },
      error: (err) => this.error = err.error?.message || 'Failed to revoke key',
    });
  }

  copyKey() {
    if (this.newLicenseKey) {
      navigator.clipboard.writeText(this.newLicenseKey);
    }
  }

  cancelPaidAtPeriodEnd() {
    if (!confirm('Stop auto-renew at the end of the current billing period? You keep access until then.')) return;
    this.accountActionBusy = true;
    this.api.cancelSubscriptionAtPeriodEnd().subscribe({
      next: (r) => {
        this.accountActionBusy = false;
        let msg = 'Renewal cancelled — access continues until the end of the current period.';
        if (r.warnings?.length) msg += ` ${r.warnings.join(' ')}`;
        alert(msg);
        this.loadAll();
      },
      error: (err) => {
        this.accountActionBusy = false;
        alert(err.error?.error || 'Could not cancel renewal');
      },
    });
  }

  keepSubscriptionRenewal() {
    if (!confirm('Keep your subscription and resume auto-renew?')) return;
    this.accountActionBusy = true;
    this.api.keepSubscription().subscribe({
      next: (r) => {
        this.accountActionBusy = false;
        let msg = 'Subscription will renew as usual.';
        if (r.warnings?.length) msg += ` ${r.warnings.join(' ')}`;
        alert(msg);
        this.loadAll();
      },
      error: (err) => {
        this.accountActionBusy = false;
        alert(err.error?.error || 'Could not update subscription');
      },
    });
  }

  pauseMyAccount() {
    if (
      !confirm(
        'Pause your account? We stop charging at the next invoice, you keep full savings access for 30 days, then cloud write access becomes read-only until you reactivate.',
      )
    ) {
      return;
    }
    this.accountActionBusy = true;
    this.api.pauseCloudService().subscribe({
      next: (r) => {
        this.accountActionBusy = false;
        const w = r.stripe?.warnings?.length ? ` ${r.stripe.warnings.join(' ')}` : '';
        alert(`Account pause scheduled.${w}`);
        this.loadAll();
      },
      error: (err) => {
        this.accountActionBusy = false;
        alert(err.error?.error || 'Could not pause');
      },
    });
  }

  resumeMyAccount() {
    this.accountActionBusy = true;
    this.api.resumeCloudService().subscribe({
      next: (r) => {
        this.accountActionBusy = false;
        const w = r.stripe?.warnings?.length ? ` ${r.stripe.warnings.join(' ')}` : '';
        alert(`Account reactivated.${w}`);
        this.loadAll();
      },
      error: (err) => {
        this.accountActionBusy = false;
        alert(err.error?.error || 'Could not resume');
      },
    });
  }

  deleteMyAccount() {
    if (this.deleteConfirmText !== 'DELETE_MY_ACCOUNT') {
      alert('Type DELETE_MY_ACCOUNT in the box to confirm permanent deletion.');
      return;
    }
    if (!confirm('This permanently deletes your Spectyra data and login. Continue?')) return;
    this.accountActionBusy = true;
    this.api.deleteMyAccount().subscribe({
      next: () => {
        this.accountActionBusy = false;
        window.location.href = '/login';
      },
      error: (err) => {
        this.accountActionBusy = false;
        alert(err.error?.error || 'Deletion failed');
      },
    });
  }

  anySubScheduledCancel(): boolean {
    return !!this.accountSummary?.owned_subscriptions?.some((s) => s.cancel_at_period_end);
  }
}
