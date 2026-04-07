import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { SPECTYRA_MONTHLY_PRICE_LABEL, SPECTYRA_TRIAL_DAYS } from '../../core/product.constants';

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
  entitlement: any = null;
  billingStatus: any = null;
  licenseKeys: LicenseKey[] = [];
  loading = true;
  error: string | null = null;
  upgrading = false;
  generatingKey = false;
  newDeviceName = '';
  newLicenseKey: string | null = null;

  constructor(private api: ApiClientService) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    this.error = null;
    let loaded = 0;
    const done = () => { loaded++; if (loaded >= 3) this.loading = false; };

    this.api.getEntitlement().subscribe({
      next: (data) => { this.entitlement = data; done(); },
      error: (err) => { this.error = err.error?.message || 'Failed to load entitlement'; done(); },
    });

    this.api.getBillingStatus().subscribe({
      next: (data) => { this.billingStatus = data; done(); },
      error: () => done(),
    });

    this.api.getLicenseKeys().subscribe({
      next: (data) => { this.licenseKeys = data; done(); },
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
}
