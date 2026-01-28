import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, shareReplay, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface MeResponse {
  org: {
    id: string;
    name: string;
    trial_ends_at: string | null;
    subscription_status: string;
  };
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
}

@Injectable({
  providedIn: 'root',
})
export class MeService {
  private cache$: Observable<MeResponse> | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds
  private meSubject = new BehaviorSubject<MeResponse | null>(null);

  constructor(private http: HttpClient) {}

  /**
   * Get /auth/me with caching to prevent duplicate calls
   * Cache is shared across all components
   */
  getMe(forceRefresh: boolean = false): Observable<MeResponse> {
    const now = Date.now();
    const cacheValid = this.cache$ && (now - this.cacheTimestamp) < this.CACHE_TTL;

    if (cacheValid && !forceRefresh) {
      return this.cache$!;
    }

    // Create new request
    this.cache$ = this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`).pipe(
      tap(response => {
        this.meSubject.next(response);
        this.cacheTimestamp = now;
      }),
      catchError(error => {
        // Clear cache on error
        this.cache$ = null;
        this.cacheTimestamp = 0;
        this.meSubject.next(null);
        throw error;
      }),
      shareReplay(1) // Share the result with all subscribers
    );

    return this.cache$;
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
    this.cache$ = null;
    this.cacheTimestamp = 0;
    this.meSubject.next(null);
  }
}
