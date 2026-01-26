import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiClientService } from '../../core/api/api-client.service';

interface BillingStatus {
  org: {
    id: string;
    name: string;
  };
  has_access: boolean;
  trial_ends_at: string | null;
  trial_active: boolean;
  subscription_status: string;
  subscription_active: boolean;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <h1>Billing</h1>
      <p class="subtitle">Manage your organization's subscription and billing</p>
      
      <div *ngIf="loading" class="loading">
        <p>Loading billing information...</p>
      </div>
      
      <div *ngIf="!loading && status" class="billing-content">
        <!-- Trial Status -->
        <div class="card" *ngIf="status.trial_active">
          <h2>Trial Active</h2>
          <p class="trial-info">
            Your 7-day trial ends on <strong>{{ formatDate(status.trial_ends_at) }}</strong>
          </p>
          <p class="trial-days" *ngIf="daysRemaining >= 0">
            <span class="days-badge">{{ daysRemaining }}</span> day{{ daysRemaining !== 1 ? 's' : '' }} remaining
          </p>
          <button class="btn-primary" (click)="upgrade()" [disabled]="upgrading">
            {{ upgrading ? 'Processing...' : 'Upgrade to Subscription' }}
          </button>
        </div>
        
        <!-- Trial Expired -->
        <div class="card expired" *ngIf="!status.trial_active && !status.subscription_active">
          <h2>Trial Expired</h2>
          <p class="error-message">
            Your trial has ended. Subscribe to continue using Spectyra's AI Gateway.
          </p>
          <button class="btn-primary" (click)="upgrade()" [disabled]="upgrading">
            {{ upgrading ? 'Processing...' : 'Subscribe Now' }}
          </button>
        </div>
        
        <!-- Active Subscription -->
        <div class="card active" *ngIf="status.subscription_active">
          <h2>Active Subscription</h2>
          <p class="success-message">
            Your organization has an active subscription.
          </p>
          <p class="subscription-status">
            Status: <strong>{{ status.subscription_status }}</strong>
          </p>
        </div>
        
        <!-- Organization Info -->
        <div class="card info">
          <h3>Organization</h3>
          <p><strong>Name:</strong> {{ status.org.name }}</p>
          <p><strong>ID:</strong> {{ status.org.id }}</p>
        </div>
      </div>
      
      <div *ngIf="error" class="error">
        <p>{{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .subtitle {
      color: #666;
      font-size: 16px;
      margin-bottom: 30px;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    .billing-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card h2 {
      margin: 0 0 16px 0;
      font-size: 24px;
      color: #333;
    }
    .card h3 {
      margin: 0 0 12px 0;
      font-size: 18px;
      color: #333;
    }
    .card.expired {
      border-left: 4px solid #f44336;
    }
    .card.active {
      border-left: 4px solid #4caf50;
    }
    .trial-info {
      color: #666;
      margin-bottom: 12px;
    }
    .trial-days {
      margin: 16px 0;
    }
    .days-badge {
      display: inline-block;
      background: #2196f3;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: bold;
      font-size: 18px;
    }
    .error-message {
      color: #f44336;
      margin-bottom: 16px;
    }
    .success-message {
      color: #4caf50;
      margin-bottom: 16px;
    }
    .subscription-status {
      color: #666;
    }
    .btn-primary {
      background: #2196f3;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 16px;
    }
    .btn-primary:hover:not(:disabled) {
      background: #1976d2;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .info p {
      margin: 8px 0;
      color: #666;
    }
    .error {
      background: #ffebee;
      border: 1px solid #f44336;
      border-radius: 8px;
      padding: 16px;
      color: #f44336;
      margin-top: 20px;
    }
  `],
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
