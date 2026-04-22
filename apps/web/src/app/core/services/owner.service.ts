/**
 * Owner Service
 *
 * Checks if the current user is an owner by probing an owner-only endpoint.
 * Uses GET /auth/is-platform-owner (JWT; no /v1/admin/* probe) + 30 s TTL cache so
 * non-owner users do not trigger owner middleware or OWNER_EMAIL misconfig logs.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, from } from 'rxjs';
import { debounceTime, exhaustMap, tap } from 'rxjs/operators';
import { SupabaseService } from '../../services/supabase.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

const CACHE_TTL_MS = 30_000;

@Injectable({
  providedIn: 'root',
})
export class OwnerService implements OnDestroy {
  private isOwner$ = new BehaviorSubject<boolean>(false);
  private readonly refresh$ = new Subject<void>();
  private sub: Subscription;
  private lastProbeAt = 0;

  constructor(
    private supabase: SupabaseService,
    private http: HttpClient,
  ) {
    this.sub = this.refresh$
      .pipe(
        debounceTime(80),
        exhaustMap(() => from(this.probeOnce())),
        tap((isOwner) => this.isOwner$.next(isOwner)),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private async probeOnce(): Promise<boolean> {
    if (Date.now() - this.lastProbeAt < CACHE_TTL_MS) {
      return this.isOwner$.value;
    }
    const session = await firstValueFrom(this.supabase.getSession());
    if (!session) {
      this.lastProbeAt = Date.now();
      return false;
    }
    try {
      const row = await firstValueFrom(
        this.http.get<{ is_platform_owner: boolean }>(`${environment.apiUrl}/auth/is-platform-owner`),
      );
      this.lastProbeAt = Date.now();
      return !!row?.is_platform_owner;
    } catch {
      this.lastProbeAt = Date.now();
      return false;
    }
  }

  getIsOwner(): ReturnType<BehaviorSubject<boolean>['asObservable']> {
    return this.isOwner$.asObservable();
  }

  isOwner(): boolean {
    return this.isOwner$.value;
  }

  /** Queued + debounced; safe to call many times per tick */
  refresh(): void {
    this.refresh$.next();
  }

  /** Reset cache so next refresh() re-probes the server */
  invalidate(): void {
    this.lastProbeAt = 0;
  }
}
