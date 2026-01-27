import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { SnackbarService } from '../../core/services/snackbar.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
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
    private router: Router,
    private snackbarService: SnackbarService
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
      const { error: signUpError, session, user } = await this.supabase.signUp(this.email, this.password);
      
      if (signUpError) {
        this.error = signUpError.message || 'Failed to create account';
        this.loading = false;
        return;
      }
      
      // If user was created but no session, email confirmation is likely required
      if (user && !session) {
        this.error = 'Account created! Please check your email to confirm your account, then try logging in.';
        this.loading = false;
        return;
      }

      // 2. Get access token (from signup response or by fetching fresh session)
      let token: string | null = null;
      
      // Use session from signup response if available
      if (session?.access_token) {
        token = session.access_token;
        console.log('Using session from signup response');
      } else {
        // Wait a moment for Supabase to process and update auth state
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to get fresh session from Supabase
        token = await this.supabase.getAccessToken();
        
        if (!token) {
          // Wait a bit more and try once more
          await new Promise(resolve => setTimeout(resolve, 1000));
          token = await this.supabase.getAccessToken();
        }
      }

      if (!token) {
        // No session available - likely email confirmation required
        this.error = 'Account created! Please check your email to confirm your account, then try logging in.';
        this.loading = false;
        return;
      }
      
      console.log('Got access token, proceeding with bootstrap');

      // 3. Bootstrap org/project via API
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

      if (!response || !response.api_key) {
        this.error = 'Failed to create organization. Please try again.';
        this.loading = false;
        return;
      }

      this.success = true;
      this.apiKey = response.api_key;
      this.trialEndsAt = response.org?.trial_ends_at || null;
      
      // Store API key for gateway usage
      this.authService.setApiKey(response.api_key);
      
      this.loading = false;
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.status === 401) {
        this.error = 'Authentication failed. Please check your email confirmation if required, then try logging in.';
      } else if (err.status === 400 && err.error?.error?.includes('already exists')) {
        this.error = 'An organization already exists for this account. Please log in instead.';
      } else {
        this.error = err.error?.error || err.message || 'Failed to create account';
      }
      this.loading = false;
    }
  }

  copyApiKey() {
    if (this.apiKey) {
      navigator.clipboard.writeText(this.apiKey).then(() => {
        this.snackbarService.showSuccess('API key copied to clipboard!');
      });
    }
  }

  goToApp() {
    this.router.navigate(['/overview']);
  }
}
