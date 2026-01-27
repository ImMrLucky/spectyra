import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.css'],
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
  hasSession = false; // Track if user has active Supabase session
  
  private sessionSub?: Subscription;

  constructor(
    private authService: AuthService,
    private supabase: SupabaseService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    // Check if user is already logged in
    // Use debounce to prevent multiple rapid calls
    this.sessionSub = this.supabase.getSession().pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => {
        const prevToken = prev?.access_token || null;
        const currToken = curr?.access_token || null;
        return prevToken === currToken;
      })
    ).subscribe(session => {
      this.hasSession = !!session?.access_token;
      if (session?.access_token) {
        // Only check bootstrap if we have a valid token
        this.checkBootstrap();
      } else {
        // Clear bootstrap state when session is lost
        this.needsBootstrap = false;
        this.success = false;
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
        console.log('[LoginPage] No access token available, skipping checkBootstrap');
        return;
      }

      console.log('[LoginPage] Calling /auth/me for checkBootstrap');
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
