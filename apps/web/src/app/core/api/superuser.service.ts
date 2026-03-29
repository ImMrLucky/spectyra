import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import type { AdminOrg } from './admin.service';

export type PlatformRole = 'superuser' | 'admin' | 'exempt';

export interface PlatformUserRow {
  email: string;
  role: PlatformRole;
  created_at: string;
  updated_at: string;
  created_by_email: string | null;
}

@Injectable({ providedIn: 'root' })
export class SuperuserService {
  private readonly base = `${environment.apiUrl}/superuser`;
  private isSuperuser$ = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient) {}

  refresh(): Observable<{ is_superuser: boolean; platform_role: string | null }> {
    return this.http.get<{ is_superuser: boolean; platform_role: string | null }>(`${this.base}/me`).pipe(
      tap((r) => this.isSuperuser$.next(!!r.is_superuser)),
      catchError(() => {
        this.isSuperuser$.next(false);
        return of({ is_superuser: false, platform_role: null });
      }),
    );
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
}
