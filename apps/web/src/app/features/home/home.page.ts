import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { MeService } from '../../core/services/me.service';
import { of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  constructor(
    private router: Router,
    private supabase: SupabaseService,
    private authService: AuthService,
    private meService: MeService
  ) {}

  ngOnInit() {
    // Redirect authenticated users, but avoid routes that assume org state exists.
    // Brand-new Supabase users have a session, but /auth/me returns needs_bootstrap until
    // POST /auth/ensure-account or bootstrap runs. Try auto-provision, then send to /login if still needed.
    this.supabase
      .getSession()
      .pipe(
        take(1),
        switchMap((session) => {
          const hasApiKey = !!this.authService.currentApiKey;
          if (hasApiKey) return of({ kind: 'org' as const });

          if (!session?.access_token) return of({ kind: 'public' as const });

          return this.meService.getMe().pipe(
            take(1),
            switchMap((me) => {
              if (me?.needs_bootstrap || !me?.org) {
                return this.meService.ensureOrgIfNeeded().pipe(
                  map(({ me: m }) => m),
                  catchError(() => of(null)),
                );
              }
              return of(me);
            }),
            map((me) =>
              me && me.org && !me.needs_bootstrap
                ? { kind: 'org' as const }
                : { kind: 'needs-bootstrap' as const }
            ),
            catchError((err: any) => {
              // Legacy API: 404 + needs_bootstrap
              if (err?.status === 404 && (err?.error?.needs_bootstrap || err?.error?.error === 'Organization not found')) {
                return of({ kind: 'needs-bootstrap' as const });
              }
              if (err?.status === 401) {
                return of({ kind: 'public' as const });
              }
              // Offline / 5xx: stay on home instead of sending to overview (avoids error loops).
              return of({ kind: 'unknown' as const });
            })
          );
        })
      )
      .subscribe(({ kind }) => {
        if (kind === 'org') this.router.navigate(['/overview']);
        if (kind === 'needs-bootstrap') this.router.navigate(['/login']);
      });
  }
}
