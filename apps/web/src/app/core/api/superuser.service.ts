import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, finalize, shareReplay } from 'rxjs/operators';
import type { AdminOrg } from './admin.service';

export type PlatformRole = 'superuser' | 'admin' | 'exempt';

export interface PlatformUserRow {
  email: string;
  role: PlatformRole;
  created_at: string;
  updated_at: string;
  created_by_email: string | null;
}

export interface SuperuserMeResponse {
  is_superuser: boolean;
  platform_role: string | null;
}

const CACHE_TTL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class SuperuserService {
  private readonly base = `${environment.apiUrl}/superuser`;
  private isSuperuser$ = new BehaviorSubject<boolean>(false);
  private inFlight: Observable<SuperuserMeResponse> | null = null;
  private cachedResult: SuperuserMeResponse | null = null;
  private cachedAt = 0;

  constructor(private http: HttpClient) {}

  refresh(): Observable<SuperuserMeResponse> {
    if (this.cachedResult && Date.now() - this.cachedAt < CACHE_TTL_MS) {
      this.isSuperuser$.next(!!this.cachedResult.is_superuser);
      return of(this.cachedResult);
    }
    if (!this.inFlight) {
      this.inFlight = this.http.get<SuperuserMeResponse>(`${this.base}/me`).pipe(
        tap((r) => {
          this.cachedResult = r;
          this.cachedAt = Date.now();
          this.isSuperuser$.next(!!r.is_superuser);
        }),
        catchError(() => {
          this.cachedResult = { is_superuser: false, platform_role: null };
          this.cachedAt = Date.now();
          this.isSuperuser$.next(false);
          return of(this.cachedResult);
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => {
          this.inFlight = null;
        }),
      );
    }
    return this.inFlight;
  }

  getIsSuperuser(): Observable<boolean> {
    return this.isSuperuser$.asObservable();
  }

  listPlatformUsers(): Observable<{ users: PlatformUserRow[] }> {
    return this.http.get<{ users: PlatformUserRow[] }>(`${this.base}/platform-users`);
  }

  upsertPlatformUser(email: string, role: PlatformRole): Observable<{ user: PlatformUserRow }> {
    return this.http.post<{ user: PlatformUserRow }>(`${this.base}/platform-users`, { email, role });
  }

  deletePlatformUser(email: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/platform-users/${encodeURIComponent(email)}`,
    );
  }

  setOrgPlatformExempt(orgId: string, exempt: boolean): Observable<{ org: AdminOrg }> {
    return this.http.patch<{ org: AdminOrg }>(`${this.base}/orgs/${encodeURIComponent(orgId)}/platform-exempt`, {
      exempt,
    });
  }

  setSavingsObserveMode(
    orgId: string,
    mode: 'auto' | 'force_observe' | 'force_full',
  ): Observable<{ org: AdminOrg }> {
    return this.http.patch<{ org: AdminOrg }>(
      `${this.base}/orgs/${encodeURIComponent(orgId)}/savings-observe-mode`,
      { mode },
    );
  }
}
