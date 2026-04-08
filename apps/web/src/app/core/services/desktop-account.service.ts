import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { MeService } from './me.service';
import { AuthService } from '../auth/auth.service';

/**
 * After Supabase sign-in on Electron, ensure the Spectyra org + API key exist via
 * POST /auth/ensure-account (same behavior as web bootstrap / CLI companion).
 */
@Injectable({
  providedIn: 'root',
})
export class DesktopSpectyraAccountService {
  constructor(
    private readonly me: MeService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Idempotent: only calls the API when /auth/me indicates `needs_bootstrap` or no org.
   * Persists a newly provisioned API key via AuthService when the server returns one.
   */
  syncAfterSessionEstablished(): void {
    if (!environment.isDesktop) return;

    const cached = this.me.getCachedMe();
    if (cached?.org && !cached.needs_bootstrap) {
      return;
    }

    this.me.ensureDesktopOrgIfNeeded().subscribe({
      next: ({ provisionedApiKey }) => {
        if (provisionedApiKey) {
          this.auth.setApiKey(provisionedApiKey);
        }
      },
      error: () => {
        /* offline / transient — user can retry by navigating */
      },
    });
  }
}
