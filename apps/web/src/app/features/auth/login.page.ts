import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="card">
        <h1>Login</h1>
        
        <!-- Tabs for auth method -->
        <div class="tabs">
          <button 
            class="tab" 
            [class.active]="authMethod === 'supabase'"
            (click)="authMethod = 'supabase'">
            Email & Password
          </button>
          <button 
            class="tab" 
            [class.active]="authMethod === 'apikey'"
            (click)="authMethod = 'apikey'">
            API Key
          </button>
        </div>

        <!-- Supabase Email/Password Form -->
        <form (ngSubmit)="loginSupabase()" *ngIf="authMethod === 'supabase' && !success">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              [(ngModel)]="email"
              [disabled]="loading"
              required
              placeholder="you@example.com"
              class="form-input">
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              [(ngModel)]="password"
              [disabled]="loading"
              required
              placeholder="••••••••"
              class="form-input">
          </div>
          
          <button type="submit" class="btn btn-primary" [disabled]="loading || !email || !password">
            {{ loading ? 'Logging in...' : 'Login' }}
          </button>
          
          <div class="help-text">
            Don't have an account? <a routerLink="/register">Sign up</a>
          </div>
        </form>

        <!-- API Key Form (Legacy) -->
        <form (ngSubmit)="loginApiKey()" *ngIf="authMethod === 'apikey' && !success">
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

        <!-- Bootstrap Flow (First-time Supabase user) -->
        <div *ngIf="needsBootstrap && authMethod === 'supabase'" class="bootstrap-box">
          <h2>Welcome to Spectyra!</h2>
          <p>Let's set up your organization to get started.</p>
          
          <form (ngSubmit)="bootstrap()" *ngIf="!bootstrapSuccess">
            <div class="form-group">
              <label for="orgName">Organization Name</label>
              <input
                type="text"
                id="orgName"
                [(ngModel)]="orgName"
                [disabled]="bootstrapLoading"
                required
                placeholder="My Company"
                class="form-input">
            </div>
            
            <div class="form-group">
              <label for="projectName">Project Name (Optional)</label>
              <input
                type="text"
                id="projectName"
                [(ngModel)]="projectName"
                [disabled]="bootstrapLoading"
                placeholder="Default Project"
                class="form-input">
            </div>
            
            <button type="submit" class="btn btn-primary" [disabled]="bootstrapLoading || !orgName">
              {{ bootstrapLoading ? 'Setting up...' : 'Create Organization' }}
            </button>
          </form>
          
          <div *ngIf="bootstrapSuccess && bootstrapApiKey" class="api-key-box">
            <h3>🎉 Organization Created!</h3>
            <p><strong>Save your API key now</strong> - you won't be able to see it again!</p>
            <div class="api-key-display">
              <code>{{ bootstrapApiKey }}</code>
              <button class="btn btn-secondary" (click)="copyApiKey()">Copy</button>
            </div>
            <button class="btn btn-primary" (click)="goToApp()">Continue to App</button>
          </div>
        </div>
        
        <!-- Success State -->
        <div *ngIf="success && !needsBootstrap" class="success-box">
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
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      border-bottom: 2px solid #e0e0e0;
    }
    .tab {
      flex: 1;
      padding: 12px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #666;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
    }
    .tab.active {
      color: #007bff;
      border-bottom-color: #007bff;
    }
    .tab:hover {
      color: #007bff;
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
      text-align: center;
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
    .btn-secondary {
      background: #6c757d;
      color: white;
      width: auto;
      margin-left: 8px;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .bootstrap-box {
      margin-top: 24px;
      padding: 24px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .bootstrap-box h2 {
      margin: 0 0 8px;
      font-size: 20px;
    }
    .api-key-box {
      text-align: center;
    }
    .api-key-display {
      background: white;
      border: 2px solid #007bff;
      border-radius: 4px;
      padding: 16px;
      margin: 20px 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .api-key-display code {
      flex: 1;
      font-family: monospace;
      font-size: 14px;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      color: #333;
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
export class LoginPage implements OnInit, OnDestroy {
  authMethod: 'supabase' | 'apikey' = 'supabase';
  email = '';
  password = '';
  apiKey = '';
  loading = false;
  success = false;
  error: string | null = null;
  userEmail: string | null = null;
  trialActive = false;
  trialEndsAt: string | null = null;
  hasAccess = false;
  
  // Bootstrap state
  needsBootstrap = false;
  bootstrapLoading = false;
  bootstrapSuccess = false;
  orgName = '';
  projectName = '';
  bootstrapApiKey: string | null = null;
  
  private sessionSub?: Subscription;

  constructor(
    private authService: AuthService,
    private supabase: SupabaseService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    // Check if user is already logged in
    this.sessionSub = this.supabase.getSession().subscribe(session => {
      if (session) {
        this.checkBootstrap();
      }
    });
  }

  ngOnDestroy() {
    this.sessionSub?.unsubscribe();
  }

  async loginSupabase() {
    if (!this.email || !this.password) {
      this.error = 'Please enter email and password';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      const { error } = await this.supabase.signIn(this.email, this.password);
      
      if (error) {
        this.error = error.message || 'Failed to login';
        this.loading = false;
        return;
      }

      // Check if user needs to bootstrap org/project
      await this.checkBootstrap();
      this.loading = false;
    } catch (err: any) {
      this.error = err.message || 'Failed to login';
      this.loading = false;
    }
  }

  async checkBootstrap() {
    try {
      const token = await this.supabase.getAccessToken();
      if (!token) {
        return;
      }

      // Interceptor will automatically add Authorization header
      try {
        // Try to get user's org info
        const me = await this.http.get<any>(`${environment.apiUrl}/auth/me`).toPromise();
        if (me && me.org) {
          // User has org, proceed normally
          this.success = true;
          this.userEmail = me.org.name;
          this.hasAccess = me.has_access;
          this.trialActive = me.trial_active;
          this.trialEndsAt = me.org.trial_ends_at;
          this.needsBootstrap = false;
        }
      } catch (err: any) {
        // Check if error indicates user needs bootstrap
        if (err.status === 404 && err.error?.needs_bootstrap) {
          // User doesn't have an org yet, show bootstrap
          this.needsBootstrap = true;
        } else if (err.status === 401 || err.status === 404) {
          // Also show bootstrap for 404 (org not found)
          this.needsBootstrap = true;
        } else {
          // Other error - show error message
          this.error = err.error?.error || 'Failed to check organization status';
        }
      }
    } catch (err: any) {
      this.error = 'Failed to check organization status';
    }
  }

  async bootstrap() {
    if (!this.orgName || this.orgName.trim().length === 0) {
      this.error = 'Please enter an organization name';
      return;
    }

    this.bootstrapLoading = true;
    this.error = null;

    try {
      // Interceptor will automatically add Authorization header
      const response = await this.http.post<any>(
        `${environment.apiUrl}/auth/bootstrap`,
        {
          org_name: this.orgName.trim(),
          project_name: this.projectName.trim() || undefined
        }
      ).toPromise();

      this.bootstrapSuccess = true;
      this.bootstrapApiKey = response.api_key;
      this.userEmail = response.org.name;
      this.trialEndsAt = response.org.trial_ends_at;
      
      // Store API key for gateway usage
      if (response.api_key) {
        this.authService.setApiKey(response.api_key);
      }
      
      this.bootstrapLoading = false;
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to create organization';
      this.bootstrapLoading = false;
    }
  }

  loginApiKey() {
    if (!this.apiKey) {
      this.error = 'Please enter your API key';
      return;
    }

    this.loading = true;
    this.error = null;

    this.authService.login(this.apiKey).subscribe({
      next: (response) => {
        this.success = true;
        this.userEmail = response.org.name;
        this.hasAccess = response.has_access;
        this.loading = false;
        
        this.authService.getMe().subscribe({
          next: (me) => {
            this.trialActive = me.trial_active;
            this.trialEndsAt = me.org?.trial_ends_at || null;
            this.userEmail = me.org?.name || this.userEmail;
          },
          error: () => {},
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

  copyApiKey() {
    if (this.bootstrapApiKey) {
      navigator.clipboard.writeText(this.bootstrapApiKey).then(() => {
        alert('API key copied to clipboard!');
      });
    }
  }

  goToApp() {
    this.router.navigate(['/scenarios']);
  }
}
