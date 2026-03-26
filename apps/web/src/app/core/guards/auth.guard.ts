import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../auth/auth.service';
import { map } from 'rxjs/operators';
import { from, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Auth Guard - Protects routes that require authentication
 *
 * Allows access if:
 * - User has Supabase session, OR
 * - User has API key stored
 *
 * Uses `getAccessToken()` (not only the session Observable) so we wait for
 * Supabase to hydrate from storage. Otherwise the BehaviorSubject can still
 * be null on first navigation after refresh/login and we falsely redirect to /login.
 */
export const authGuard: CanActivateFn = (route, state) => {
  if (environment.isDesktop) {
    return of(true);
  }
  const router = inject(Router);
  const supabase = inject(SupabaseService);
  const authService = inject(AuthService);

  return from(supabase.getAccessToken()).pipe(
    map((token) => {
      const hasApiKey = !!authService.currentApiKey;
      const isAuthenticated = !!token || hasApiKey;

      if (!isAuthenticated) {
        router.navigate(['/login'], {
          queryParams: { returnUrl: state.url },
        });
        return false;
      }

      return true;
    })
  );
};
