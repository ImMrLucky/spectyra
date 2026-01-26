import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="card">
        <h1>Login</h1>
        <p class="subtitle">Enter your Spectyra API key to continue</p>
        
        <form (ngSubmit)="login()" *ngIf="!success">
          <div class="form-group">
            <label for="apiKey">API Key</label>
            <input
              type="password"
              id="apiKey"
              [(ngModel)]="apiKey"
              [disabled]="loading"
              required
              placeholder="sk_spectyra_..."
              class="form-input">
            <div class="help-text">
              Don't have an API key? <a routerLink="/register">Create an account</a>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary" [disabled]="loading || !apiKey">
            {{ loading ? 'Logging in...' : 'Login' }}
          </button>
        </form>
        
        <div *ngIf="success" class="success-box">
          <h2>✅ Logged In</h2>
          <p>Welcome back, {{ userEmail }}!</p>
          <div class="trial-info" *ngIf="trialActive">
            <p>✅ <strong>Free trial active</strong></p>
            <p>Trial ends: {{ trialEndsAt | date:'medium' }}</p>
          </div>
          <div class="warning-box" *ngIf="!hasAccess">
            <p>⚠️ Your trial has expired. Please subscribe to continue.</p>
          </div>
          <button class="btn btn-primary" (click)="goToApp()">Continue to App</button>
        </div>
        
        <div *ngIf="error" class="error-box">
          <p>{{ error }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 500px;
      margin: 40px auto;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 600;
    }
    .subtitle {
      color: #666;
      margin-bottom: 24px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
    }
    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    .help-text {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
    .help-text a {
      color: #007bff;
      text-decoration: none;
    }
    .btn {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 8px;
    }
    .btn-primary {
      background: #007bff;
      color: white;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .success-box {
      text-align: center;
    }
    .success-box h2 {
      margin: 0 0 16px;
      color: #28a745;
    }
    .trial-info {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 4px;
      padding: 16px;
      margin: 20px 0;
      text-align: left;
    }
    .trial-info p {
      margin: 8px 0;
      color: #155724;
    }
    .warning-box {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      padding: 16px;
      margin: 20px 0;
      color: #856404;
    }
    .error-box {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      padding: 12px;
      margin: 16px 0;
      color: #721c24;
    }
  `],
})
export class LoginPage {
  apiKey = '';
  loading = false;
  success = false;
  error: string | null = null;
  userEmail: string | null = null;
  trialActive = false;
  trialEndsAt: string | null = null;
  hasAccess = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login() {
    if (!this.apiKey) {
      this.error = 'Please enter your API key';
      return;
    }

    this.loading = true;
    this.error = null;

    this.authService.login(this.apiKey).subscribe({
      next: (response) => {
        this.success = true;
        this.userEmail = response.org.name; // Show org name instead of email
        this.hasAccess = response.has_access;
        this.loading = false;
        
        // Get full org info
        this.authService.getMe().subscribe({
          next: (me) => {
            this.trialActive = me.trial_active;
            this.trialEndsAt = me.org?.trial_ends_at || null;
            this.userEmail = me.org?.name || this.userEmail;
          },
          error: () => {
            // Ignore errors
          },
        });
      },
      error: (err) => {
        if (err.status === 401) {
          this.error = 'Invalid API key';
        } else if (err.status === 402) {
          this.error = 'Your trial has expired. Please subscribe to continue.';
        } else {
          this.error = err.error?.error || 'Failed to login';
        }
        this.loading = false;
      },
    });
  }

  goToApp() {
    this.router.navigate(['/scenarios']);
  }
}
