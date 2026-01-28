import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {MeService} from "../core/services/me.service";

interface Org {
  id: string;
  name: string;
  subscription_status: string;
}

interface Project {
  id: string;
  name: string;
  org_id: string;
}

@Component({
  selector: 'app-org-switcher',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './org-switcher.component.html',
  styleUrls: ['./org-switcher.component.scss'],
})
export class OrgSwitcherComponent implements OnInit, OnDestroy {
  org: Org | null = null;
  projects: Project[] = [];
  currentProjectId: string | null = null;
  showDropdown = false;
  loading = false;
  
  private sessionSub?: Subscription;

  constructor(
    private supabase: SupabaseService,
    private http: HttpClient,
    private meService: MeService
  ) {}

  ngOnInit() {
    // Debounce session changes to prevent multiple rapid calls
    // Also add distinctUntilChanged to prevent duplicate calls
    this.sessionSub = this.supabase.getSession().pipe(
      debounceTime(500), // Wait 500ms after last emission
      distinctUntilChanged((prev, curr) => {
        // Only reload if session actually changed (was null, now exists, or vice versa)
        // Also check if access_token changed
        const prevToken = prev?.access_token || null;
        const currToken = curr?.access_token || null;
        return prevToken === currToken;
      })
    ).subscribe(session => {
      if (session?.access_token) {
        // Only load if we have a valid token
        this.loadOrgInfo();
      } else {
        // Clear org info when session is lost
        this.org = null;
        this.projects = [];
      }
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
      const me = await this.meService.getMe().toPromise();
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

  selectProject(project: Project) {
    this.currentProjectId = project.id;
    // TODO: Store selected project in service/state
    // TODO: Reload data filtered by project
    this.showDropdown = false;
  }
}
