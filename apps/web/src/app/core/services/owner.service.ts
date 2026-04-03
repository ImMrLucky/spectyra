/**
 * Owner Service
 *
 * Checks if the current user is an owner by probing an owner-only endpoint.
 * Owner access is enforced server-side (configured via OWNER_EMAIL / platform superuser).
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, from } from 'rxjs';
import { debounceTime, exhaustMap, tap } from 'rxjs/operators';
import { SupabaseService } from '../../services/supabase.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OwnerService implements OnDestroy {
  private isOwner$ = new BehaviorSubject<boolean>(false);
  private readonly refresh$ = new Subject<void>();
  private sub: Subscription;

  constructor(
    private supabase: SupabaseService,
    private http: HttpClient,
  ) {
    // Coalesce rapid refresh() calls (e.g. AppComponent auth churn) into one HTTP request
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
    const session = await firstValueFrom(this.supabase.getSession());
    if (!session) {
      return false;
    }
    try {
      await firstValueFrom(
        this.http.get(`${environment.apiUrl}/admin/orgs`, {
          observe: 'response',
        }),
      );
      return true;
    } catch {
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
}
