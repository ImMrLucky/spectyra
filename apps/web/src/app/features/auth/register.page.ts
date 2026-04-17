import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { MeService } from '../../core/services/me.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { savePendingBootstrap } from '../../core/auth/pending-bootstrap.storage';
import { firstValueFrom } from 'rxjs';

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
  /** Shown after sign-up when email confirmation is required (green banner, not an error). */
  successMessage: string | null = null;
  apiKey: string | null = null;

  constructor(
    private supabase: SupabaseService,
    private http: HttpClient,
    private authService: AuthService,
    private meService: MeService,
    private router: Router,
    readonly route: ActivatedRoute,
    private snackbarService: SnackbarService
  ) {}

  async register() {
    if (!this.email || !this.password || !this.orgName) {
      this.error = 'Please fill in all required fields';
      this.successMessage = null;
      return;
    }

    if (this.password.length < 8) {
      this.error = 'Password must be at least 8 characters';
      this.successMessage = null;
      return;
    }

    this.loading = true;
    this.error = null;
    this.successMessage = null;

    try {
      // 1. Sign up with Supabase
      const { error: signUpError, session, user } = await this.supabase.signUp(this.email, this.password);
      
      if (signUpError) {
        this.successMessage = null;
        this.error = signUpError.message || 'Failed to create account';
        this.loading = false;
        return;
      }

      // 2. Get access token — auto-confirm if email verification is blocking
      let token: string | null = session?.access_token ?? null;

      if (user && !token) {
        // Email confirmation is enabled in Supabase — auto-confirm server-side
        try {
          const confirmRes = await fetch(`${environment.apiUrl}/auth/auto-confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: this.email }),
          });
          if (!confirmRes.ok) {
            console.warn('[register] auto-confirm failed', confirmRes.status);
          }
        } catch (e) {
          console.warn('[register] auto-confirm error', e);
        }

        // Now sign in to get a session
        const { error: signInError } = await this.supabase.signIn(this.email, this.password);
        if (signInError) {
          console.warn('[register] post-confirm sign-in failed', signInError);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        token = await this.supabase.getAccessToken();
      }

      if (!token) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        token = await this.supabase.getAccessToken();
      }

      if (!token) {
        savePendingBootstrap({ orgName: this.orgName, projectName: this.projectName });
        this.successMessage =
          'Account created! Please sign in to complete setup.';
        this.loading = false;
        return;
      }

      // 3. Bootstrap org/project via API
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });

      const response = await firstValueFrom(this.http.post<any>(
        `${environment.apiUrl}/auth/bootstrap`,
        {
          org_name: this.orgName.trim(),
          project_name: this.projectName.trim() || undefined
        },
        { headers }
      ));

      if (!response || !response.api_key) {
        this.successMessage = null;
        this.error = 'Failed to create organization. Please try again.';
        this.loading = false;
        return;
      }

      this.success = true;
      this.apiKey = response.api_key;

      this.meService.clearCache();

      // Store API key for gateway usage
      this.authService.setApiKey(response.api_key);

      this.loading = false;
    } catch (err: any) {
      console.error('Registration error:', err);
      this.successMessage = null;
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
    const raw = this.route.snapshot.queryParams['returnUrl'];
    const target =
      typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/overview';
    void this.router.navigateByUrl(target);
  }
}
