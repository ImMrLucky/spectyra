import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../auth/auth.service';
import { map } from 'rxjs/operators';
import { combineLatest } from 'rxjs';

/**
 * Auth Guard - Protects routes that require authentication
 * 
 * Allows access if:
 * - User has Supabase session, OR
 * - User has API key stored
 * 
 * Redirects to /login if not authenticated
 */
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const supabase = inject(SupabaseService);
  const authService = inject(AuthService);

  return combineLatest([
    supabase.getSession(),
    authService.authState
  ]).pipe(
    map(([session, authState]) => {
      const isAuthenticated = !!session || !!authState.apiKey;
      
      if (!isAuthenticated) {
        router.navigate(['/login'], { 
          queryParams: { returnUrl: state.url } 
        });
        return false;
      }
      
      return true;
    })
  );
};
