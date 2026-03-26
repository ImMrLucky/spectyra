import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { environment } from '../../environments/environment';
import { Subscription, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, take } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import {MeService} from "../core/services/me.service";
import type { OrgDisplay, ProjectDisplay } from '@spectyra/shared';

@Component({
  selector: 'app-org-switcher',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './org-switcher.component.html',
  styleUrls: ['./org-switcher.component.scss'],
})
export class OrgSwitcherComponent implements OnInit, OnDestroy {
  org: OrgDisplay | null = null;
  projects: ProjectDisplay[] = [];
  currentProjectId: string | null = null;
  showDropdown = false;
  loading = false;
  
  private sessionSub?: Subscription;

  constructor(
    private supabase: SupabaseService,
    private meService: MeService,
    private router: Router
  ) {}

  ngOnInit() {
    const onSessionOrRoute = () => this.applySessionToOrgSwitcher();

    // Debounce session changes to prevent multiple rapid calls
    const session$ = this.supabase.getSession().pipe(
      debounceTime(500),
      distinctUntilChanged((prev, curr) => {
        const prevToken = prev?.access_token || null;
        const currToken = curr?.access_token || null;
        return prevToken === currToken;
      })
    );

    // When leaving /login or /register with the same token, session$ may not re-emit — reload org after navigation.
    const nav$ = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    );

    this.sessionSub = merge(session$, nav$).subscribe(onSessionOrRoute);
  }

  /** Load org/projects for the shell, but not on auth pages (login/register already call /auth/me). */
  private applySessionToOrgSwitcher(): void {
    this.supabase
      .getSession()
      .pipe(take(1))
      .subscribe((session) => {
        if (!session?.access_token) {
          this.org = null;
          this.projects = [];
          return;
        }
        const path = this.router.url.split('?')[0] || '';
        if (path === '/login' || path === '/register') {
          this.org = null;
          this.projects = [];
          return;
        }
        this.loadOrgInfo();
      });
  }

  ngOnDestroy() {
    this.sessionSub?.unsubscribe();
  }

  private loadInProgress = false;

  async loadOrgInfo() {
    // Prevent concurrent calls
    if (this.loadInProgress) {
      return;
    }
    
    this.loadInProgress = true;
    this.loading = true;
    
    try {
      // Verify we have a token before making the call
      const token = await this.supabase.getAccessToken();
      if (!token) {
        this.loading = false;
        this.loadInProgress = false;
        return;
      }

      // Use MeService to prevent duplicate calls
      const me = await firstValueFrom(this.meService.getMe());
      if (me) {
        if (me.org) {
          this.org = me.org;
        }
        if (me.projects) {
          this.projects = me.projects;
        }
      }
    } catch (err: any) {
      // Don't clear org info on error - keep last known state
    } finally {
      this.loading = false;
      this.loadInProgress = false;
    }
  }

  selectProject(project: ProjectDisplay) {
    this.currentProjectId = project.id;
    // TODO: Store selected project in service/state
    // TODO: Reload data filtered by project
    this.showDropdown = false;
  }
}
