import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiClientService } from '../../core/api/api-client.service';
import type { BillingStatus } from '@spectyra/shared';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './billing.page.html',
  styleUrls: ['./billing.page.scss'],
})
export class BillingPage implements OnInit {
  status: BillingStatus | null = null;
  loading = true;
  error: string | null = null;
  upgrading = false;
  daysRemaining = 0;

  constructor(private api: ApiClientService) {}

  ngOnInit() {
    this.loadBillingStatus();
  }

  loadBillingStatus() {
    this.loading = true;
    this.error = null;
    
    this.api.getBillingStatus().subscribe({
      next: (data) => {
        this.status = data;
        this.calculateDaysRemaining();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load billing status';
        this.loading = false;
      },
    });
  }

  calculateDaysRemaining() {
    if (this.status?.trial_ends_at) {
      const endDate = new Date(this.status.trial_ends_at);
      const now = new Date();
      const diff = endDate.getTime() - now.getTime();
      this.daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  upgrade() {
    this.upgrading = true;
    const successUrl = `${window.location.origin}/billing/success`;
    const cancelUrl = `${window.location.origin}/billing`;
    
    this.api.createCheckout(successUrl, cancelUrl).subscribe({
      next: (data) => {
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        } else {
          this.error = 'Failed to create checkout session';
          this.upgrading = false;
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to create checkout session';
        this.upgrading = false;
      },
    });
  }
}
