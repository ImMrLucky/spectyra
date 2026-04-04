import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { MeService } from '../../core/services/me.service';
import { IntegrationOnboardingService } from '../integrations/services/integration-onboarding.service';
import { buildChecklistItems, ONBOARDING_COPY } from '../integrations/services/map-onboarding-state';
import { OnboardingChecklistComponent } from '../integrations/onboarding/onboarding-checklist.component';
import { OnboardingActionCardComponent } from '../integrations/onboarding/onboarding-action-card.component';
import { OnboardingDiagnosticsComponent } from '../integrations/onboarding/onboarding-diagnostics.component';
import type { OnboardingAction } from '../integrations/models/integration-onboarding.types';

@Component({
  selector: 'app-openclaw-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    OnboardingChecklistComponent,
    OnboardingActionCardComponent,
    OnboardingDiagnosticsComponent,
  ],
  templateUrl: './openclaw-onboarding.page.html',
  styleUrls: ['./openclaw-onboarding.page.scss'],
})
export class OpenClawOnboardingPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly supabase = inject(SupabaseService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly meService = inject(MeService);
  readonly onboarding = inject(IntegrationOnboardingService);

  readonly checklist = computed(() =>
    buildChecklistItems(this.onboarding.status(), { isDesktop: environment.isDesktop }),
  );

  readonly headline = computed(() => {
    const st = this.onboarding.status().state;
    if (st === 'checking') {
      return { title: 'Connect OpenClaw to Spectyra', body: 'Checking your local setup…' };
    }
    if (st === 'desktop_installed_companion_not_running' && environment.isDesktop) {
      return {
        title: 'Spectyra is still starting',
        body: 'Wait a few seconds and tap Refresh. If this stays red, quit Spectyra completely and open it again.',
      };
    }
    const key = st as keyof typeof ONBOARDING_COPY;
    return ONBOARDING_COPY[key] ?? ONBOARDING_COPY.error;
  });

  readonly productSubtitle =
    'OpenClaw sends requests to Spectyra running locally on your machine. Spectyra optimizes them locally, then sends them directly to your AI provider using your own API keys.';

  /* ── Inline auth state ── */
  authMode: 'login' | 'register' = 'login';
  authEmail = '';
  authPassword = '';
  authOrgName = '';
  authLoading = false;
  authError: string | null = null;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.onboarding.assumeOpenClawFromFlow =
      q.get('from') === 'clawhub' || q.get('from') === 'openclaw' || q.get('openclaw') === '1';
    void this.onboarding.refreshOpenClawStatus();
  }

  async onAction(a: OnboardingAction): Promise<void> {
    await this.onboarding.executeAction(a.type);
  }

  async onDiagRetry(): Promise<void> {
    await this.onboarding.refreshOpenClawStatus();
  }

  async doSignIn(): Promise<void> {
    if (!this.authEmail || !this.authPassword) return;
    this.authLoading = true;
    this.authError = null;
    try {
      const { error } = await this.supabase.signIn(this.authEmail, this.authPassword);
      if (error) {
        this.authError = error.message || 'Sign-in failed';
        this.authLoading = false;
        return;
      }
      this.meService.clearCache();
      await this.onboarding.refreshOpenClawStatus();
    } catch (e: any) {
      this.authError = e.message || 'Sign-in failed';
    } finally {
      this.authLoading = false;
    }
  }

  async doSignUp(): Promise<void> {
    if (!this.authEmail || !this.authPassword || !this.authOrgName) return;
    if (this.authPassword.length < 8) {
      this.authError = 'Password must be at least 8 characters';
      return;
    }
    this.authLoading = true;
    this.authError = null;
    try {
      const { error: signUpError, session, user } = await this.supabase.signUp(this.authEmail, this.authPassword);
      if (signUpError) {
        this.authError = signUpError.message || 'Failed to create account';
        this.authLoading = false;
        return;
      }

      let token: string | null = session?.access_token ?? null;

      if (user && !token) {
        try {
          const confirmRes = await fetch(`${environment.apiUrl}/auth/auto-confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: this.authEmail }),
          });
          if (!confirmRes.ok) {
            console.warn('[openclaw-onboarding] auto-confirm failed', confirmRes.status);
          }
        } catch (e) {
          console.warn('[openclaw-onboarding] auto-confirm error', e);
        }

        const { error: signInError } = await this.supabase.signIn(this.authEmail, this.authPassword);
        if (signInError) {
          console.warn('[openclaw-onboarding] post-confirm sign-in failed', signInError);
        }
        await new Promise(r => setTimeout(r, 500));
        token = await this.supabase.getAccessToken();
      }

      if (!token) {
        await new Promise(r => setTimeout(r, 1000));
        token = await this.supabase.getAccessToken();
      }

      if (!token) {
        this.authError = 'Account created but session could not be established. Try signing in.';
        this.authMode = 'login';
        this.authLoading = false;
        return;
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      });
      try {
        const response = await firstValueFrom(this.http.post<any>(
          `${environment.apiUrl}/auth/bootstrap`,
          { org_name: this.authOrgName.trim() },
          { headers },
        ));
        if (response?.api_key) {
          this.authService.setApiKey(response.api_key);
        }
      } catch (bootstrapErr: any) {
        if (bootstrapErr.status !== 400 || !bootstrapErr.error?.error?.includes('already exists')) {
          console.warn('[openclaw-onboarding] bootstrap error', bootstrapErr);
        }
      }

      this.meService.clearCache();
      await this.onboarding.refreshOpenClawStatus();
    } catch (e: any) {
      this.authError = e.message || 'Failed to create account';
    } finally {
      this.authLoading = false;
    }
  }
}
