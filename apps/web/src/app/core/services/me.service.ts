import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, shareReplay, catchError, finalize, switchMap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/** Response from POST /v1/auth/ensure-account */
export interface EnsureAccountResponse {
  already_provisioned?: boolean;
  org?: {
    id: string;
    name: string;
    trial_ends_at: string | null;
    subscription_status: string;
  };
  api_key?: string;
  license_key?: string | null;
  message?: string;
}

export interface MeResponse {
  /** Present when Supabase JWT is valid but `org_memberships` has no row yet. */
  needs_bootstrap?: boolean;
  org: {
    id: string;
    name: string;
    trial_ends_at: string | null;
    subscription_status: string;
  } | null;
  projects?: Array<{
    id: string;
    name: string;
    org_id: string;
  }>;
  project?: {
    id: string;
    name: string;
    org_id: string;
  } | null;
  has_access: boolean;
  trial_active: boolean;
  /** Installer URLs from API (DESKTOP_DOWNLOAD_* env). Optional for older servers. */
  desktop_downloads?: {
    mac_url: string | null;
    windows_url: string | null;
    windows_zip_url?: string | null;
  };
  /** OpenClaw + Spectyra bundle installers (OPENCLAW_DESKTOP_DOWNLOAD_* env). */
  openclaw_desktop_downloads?: {
    mac_url: string | null;
    windows_url: string | null;
    windows_zip_url?: string | null;
  };
}

@Injectable({
  providedIn: 'root',
})
export class MeService {
  /** Completed /auth/me stream — replays until TTL or clearCache */
  private cachedMe$: Observable<MeResponse> | null = null;
  /** In-flight request shared by all simultaneous callers */
  private inFlight$: Observable<MeResponse> | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 30000;
  private meSubject = new BehaviorSubject<MeResponse | null>(null);

  constructor(private http: HttpClient) {}

  /**
   * Get /auth/me with TTL cache + in-flight coalescing (avoids duplicate HTTP when
   * org-switcher, overview, and login all call getMe() in the same tick).
   */
  getMe(forceRefresh: boolean = false): Observable<MeResponse> {
    if (forceRefresh) {
      this.clearCache();
    }
    const now = Date.now();
    if (this.cachedMe$ && now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.cachedMe$;
    }
    if (this.inFlight$) {
      return this.inFlight$;
    }

    this.inFlight$ = this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`).pipe(
      tap((response) => {
        this.meSubject.next(response);
        this.cacheTimestamp = Date.now();
        if (response.org && !response.needs_bootstrap) {
          this.http
            .post<{ applied: boolean }>(`${environment.apiUrl}/auth/sync-billing-exempt`, {})
            .subscribe({ error: () => undefined });
        }
      }),
      catchError((error) => {
        this.cachedMe$ = null;
        this.cacheTimestamp = 0;
        this.meSubject.next(null);
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
      finalize(() => {
        this.inFlight$ = null;
      }),
    );
    this.cachedMe$ = this.inFlight$;
    return this.inFlight$;
  }

  /**
   * Get cached value synchronously (may be null)
   */
  getCachedMe(): MeResponse | null {
    return this.meSubject.value;
  }

  /**
   * Observable of cached me value
   */
  get me$(): Observable<MeResponse | null> {
    return this.meSubject.asObservable();
  }

  /**
   * Clear cache (call after logout or org changes)
   */
  clearCache(): void {
    this.cachedMe$ = null;
    this.inFlight$ = null;
    this.cacheTimestamp = 0;
    this.meSubject.next(null);
  }

  /**
   * Electron: if the user is signed in but has no Spectyra org yet, POST /auth/ensure-account
   * then refresh /auth/me. Returns a provisioned API key plaintext when the server just created one.
   */
  ensureDesktopOrgIfNeeded(): Observable<{ me: MeResponse; provisionedApiKey?: string }> {
    const cached = this.getCachedMe();
    if (cached?.org && !cached.needs_bootstrap) {
      return of({ me: cached });
    }

    return this.getMe(true).pipe(
      switchMap((me) => {
        if (me.org && !me.needs_bootstrap) {
          return of({ me });
        }
        return this.http
          .post<EnsureAccountResponse>(`${environment.apiUrl}/auth/ensure-account`, {})
          .pipe(
            switchMap((res) => {
              this.clearCache();
              return this.getMe(true).pipe(
                map((fresh) => ({
                  me: fresh,
                  provisionedApiKey: res.api_key,
                })),
              );
            }),
          );
      }),
    );
  }
}
