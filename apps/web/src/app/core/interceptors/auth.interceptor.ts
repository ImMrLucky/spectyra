import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { environment } from '../../../environments/environment';
import { from, switchMap } from 'rxjs';

/**
 * HTTP Interceptor to automatically add authentication headers
 * 
 * Priority:
 * 1. Supabase JWT (Bearer token) - for dashboard endpoints
 * 2. X-SPECTYRA-API-KEY - fallback for API key auth
 * 
 * Only applies to requests to the API base URL
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only intercept requests to our API
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  // Skip auth for public endpoints
  const publicEndpoints = [
    '/auth/register',
    '/auth/login', // Login endpoint handles its own auth
    '/health',
  ];
  
  const isPublicEndpoint = publicEndpoints.some(endpoint => 
    req.url.includes(endpoint)
  );
  
  if (isPublicEndpoint) {
    return next(req);
  }

  // Check if Authorization header is already set (manual override)
  if (req.headers.has('Authorization') || req.headers.has('X-SPECTYRA-API-KEY')) {
    return next(req);
  }

  const authService = inject(AuthService);
  const supabaseService = inject(SupabaseService);

  // Try to get Supabase JWT token first (async)
  return from(supabaseService.getAccessToken()).pipe(
    switchMap(token => {
      const headers: { [key: string]: string } = {};

      if (token) {
        // Use Supabase JWT
        headers['Authorization'] = `Bearer ${token}`;
        console.log(`[AuthInterceptor] Added Bearer token for ${req.url}`);
      } else {
        // Fall back to API key
        const apiKey = authService.currentApiKey;
        if (apiKey) {
          headers['X-SPECTYRA-API-KEY'] = apiKey;
          console.log(`[AuthInterceptor] Added API key for ${req.url}`);
        } else {
          console.warn(`[AuthInterceptor] No authentication available (no token, no API key) for ${req.url}. Request will likely fail with 401.`);
        }
      }

      // Clone request with new headers
      if (Object.keys(headers).length > 0) {
        const clonedReq = req.clone({
          setHeaders: headers,
        });
        return next(clonedReq);
      }

      // No auth available - proceed without headers (will result in 401)
      return next(req);
    })
  );
};
