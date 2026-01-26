import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="card">
        <h1>Create Account</h1>
        <p class="subtitle">Sign up for Spectyra and start saving on LLM costs</p>
        
        <form (ngSubmit)="register()" *ngIf="!success">
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
              minlength="8"
              class="form-input">
            <div class="help-text">Password must be at least 8 characters</div>
          </div>
          
          <div class="form-group">
            <label for="orgName">Organization Name</label>
            <input
              type="text"
              id="orgName"
              [(ngModel)]="orgName"
              [disabled]="loading"
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
              [disabled]="loading"
              placeholder="Default Project"
              class="form-input">
          </div>
          
          <button type="submit" class="btn btn-primary" [disabled]="loading || !email || !password || !orgName">
            {{ loading ? 'Creating Account...' : 'Create Account' }}
          </button>
        </form>
        
        <div *ngIf="success && apiKey" class="success-box">
          <h2>🎉 Account Created!</h2>
          <p>Your API key has been generated. <strong>Save it now</strong> - you won't be able to see it again!</p>
          
          <div class="api-key-box">
            <code>{{ apiKey }}</code>
            <button class="btn btn-secondary" (click)="copyApiKey()">Copy</button>
          </div>
          
          <div class="trial-info">
            <p>✅ <strong>7-day free trial</strong> - Start optimizing immediately!</p>
            <p>Trial ends: {{ trialEndsAt | date:'medium' }}</p>
          </div>
          
          <button class="btn btn-primary" (click)="goToApp()">Continue to App</button>
        </div>
        
        <div *ngIf="error" class="error-box">
          <p>{{ error }}</p>
        </div>
        
        <div class="login-link">
          Already have an account? <a routerLink="/login">Login</a>
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
    .success-box {
      text-align: center;
    }
    .success-box h2 {
      margin: 0 0 16px;
      color: #28a745;
    }
    .api-key-box {
      background: #f8f9fa;
      border: 2px solid #007bff;
      border-radius: 4px;
      padding: 16px;
      margin: 20px 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .api-key-box code {
      flex: 1;
      font-family: monospace;
      font-size: 14px;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      color: #333;
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
    .error-box {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      padding: 12px;
      margin: 16px 0;
      color: #721c24;
    }
    .login-link {
      margin-top: 24px;
      text-align: center;
      color: #666;
    }
    .login-link a {
      color: #007bff;
      text-decoration: none;
    }
  `],
})
export class RegisterPage {
  email = '';
  password = '';
  orgName = '';
  projectName = '';
  loading = false;
  success = false;
  error: string | null = null;
  apiKey: string | null = null;
  trialEndsAt: string | null = null;

  constructor(
    private supabase: SupabaseService,
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  async register() {
    if (!this.email || !this.password || !this.orgName) {
      this.error = 'Please fill in all required fields';
      return;
    }

    if (this.password.length < 8) {
      this.error = 'Password must be at least 8 characters';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      // 1. Sign up with Supabase
      const { error: signUpError } = await this.supabase.signUp(this.email, this.password);
      
      if (signUpError) {
        this.error = signUpError.message || 'Failed to create account';
        this.loading = false;
        return;
      }

      // 2. Wait a moment for Supabase to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Get access token
      const token = await this.supabase.getAccessToken();
      if (!token) {
        this.error = 'Failed to get authentication token';
        this.loading = false;
        return;
      }

      // 4. Bootstrap org/project via API
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });

      const response = await this.http.post<any>(
        `${environment.apiUrl}/auth/bootstrap`,
        {
          org_name: this.orgName.trim(),
          project_name: this.projectName.trim() || undefined
        },
        { headers }
      ).toPromise();

      this.success = true;
      this.apiKey = response.api_key;
      this.trialEndsAt = response.org.trial_ends_at || null;
      
      // Store API key for gateway usage
      if (response.api_key) {
        this.authService.setApiKey(response.api_key);
      }
      
      this.loading = false;
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to create account';
      this.loading = false;
    }
  }

  copyApiKey() {
    if (this.apiKey) {
      navigator.clipboard.writeText(this.apiKey).then(() => {
        alert('API key copied to clipboard!');
      });
    }
  }

  goToApp() {
    this.router.navigate(['/scenarios']);
  }
}
