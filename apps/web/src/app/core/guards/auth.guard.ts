import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../auth/auth.service';
import { map } from 'rxjs/operators';
import { from, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { supabase } from '../supabase/supabase.client';

/**
 * After `signInWithPassword`, `onAuthStateChange` and `getSession()` can lag behind
 * navigation. Poll the canonical Supabase client session (not only the cached token)
 * so /overview does not redirect to /login while the user is actually signed in.
 */
async function waitForAuthenticated(
  supabaseService: SupabaseService,
  authService: AuthService,
  maxWaitMs = 15000,
  intervalMs = 50,
): Promise<boolean> {
  if (authService.currentApiKey) {
    return true;
  }
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return true;
    }
    const token = await supabaseService.getAccessToken();
    if (token) {
      return true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Auth Guard - Protects routes that require authentication
 *
 * Allows access if:
 * - User has Supabase session, OR
 * - User has API key stored
 *
 * Waits briefly for Supabase to expose an access token after login before denying.
 */
export const authGuard: CanActivateFn = (route, state) => {
  if (environment.isDesktop) {
    return of(true);
  }
  const router = inject(Router);
  const supabaseService = inject(SupabaseService);
  const authService = inject(AuthService);

  return from(waitForAuthenticated(supabaseService, authService)).pipe(
    map((ok) => {
      if (!ok) {
        router.navigate(['/login'], {
          queryParams: { returnUrl: state.url },
        });
        return false;
      }
      return true;
    }),
  );
};
