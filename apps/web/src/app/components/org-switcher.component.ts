import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';

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
  template: `
    <div class="org-switcher" *ngIf="org">
      <div class="current-org" (click)="showDropdown = !showDropdown">
        <span class="org-name">{{ org.name }}</span>
        <span class="org-status" [class.active]="org.subscription_status === 'active'"
              [class.trial]="org.subscription_status === 'trial'">
          {{ org.subscription_status }}
        </span>
        <span class="dropdown-arrow">▼</span>
      </div>
      
      <div class="dropdown" *ngIf="showDropdown">
        <div class="org-info">
          <h4>{{ org.name }}</h4>
          <p class="org-id">ID: {{ org.id }}</p>
          <p class="org-status-text">Status: {{ org.subscription_status }}</p>
        </div>
        
        <div class="projects-section" *ngIf="projects.length > 0">
          <h5>Projects</h5>
          <ul class="projects-list">
            <li *ngFor="let project of projects" 
                [class.active]="currentProjectId === project.id"
                (click)="selectProject(project)">
              {{ project.name }}
            </li>
          </ul>
        </div>
        
        <div class="actions">
          <a routerLink="/settings" class="action-link">Settings</a>
          <a routerLink="/billing" class="action-link">Billing</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .org-switcher {
      position: relative;
    }
    .current-org {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(255,255,255,0.2);
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .current-org:hover {
      background: rgba(255,255,255,0.3);
    }
    .org-name {
      font-weight: 500;
      font-size: 14px;
    }
    .org-status {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .org-status.active {
      background: #4caf50;
      color: white;
    }
    .org-status.trial {
      background: #2196f3;
      color: white;
    }
    .dropdown-arrow {
      font-size: 10px;
      opacity: 0.8;
    }
    .dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 250px;
      z-index: 1000;
      padding: 16px;
    }
    .org-info {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;
    }
    .org-info h4 {
      margin: 0 0 4px 0;
      font-size: 16px;
      color: #333;
    }
    .org-id {
      font-family: monospace;
      font-size: 11px;
      color: #666;
      margin: 4px 0;
    }
    .org-status-text {
      font-size: 12px;
      color: #666;
      margin: 4px 0 0 0;
    }
    .projects-section {
      margin-bottom: 16px;
    }
    .projects-section h5 {
      margin: 0 0 8px 0;
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
    }
    .projects-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .projects-list li {
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    .projects-list li:hover {
      background: #f0f0f0;
    }
    .projects-list li.active {
      background: #e3f2fd;
      color: #1976d2;
      font-weight: 500;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }
    .action-link {
      color: #007bff;
      text-decoration: none;
      font-size: 14px;
      padding: 8px 0;
    }
    .action-link:hover {
      text-decoration: underline;
    }
  `],
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
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.sessionSub = this.supabase.getSession().subscribe(session => {
      if (session) {
        this.loadOrgInfo();
      }
    });
  }

  ngOnDestroy() {
    this.sessionSub?.unsubscribe();
  }

  async loadOrgInfo() {
    this.loading = true;
    
    try {
      const token = await this.supabase.getAccessToken();
      if (!token) {
        this.loading = false;
        return;
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });

      // Load org info
      try {
        const me = await this.http.get<any>(`${environment.apiUrl}/auth/me`, { headers }).toPromise();
        if (me && me.org) {
          this.org = me.org;
        }
        
        // Load projects (if available in response or separate endpoint)
        // TODO: Add projects endpoint or get from org info
        if (me && me.projects) {
          this.projects = me.projects;
        }
      } catch (err: any) {
        console.error('Failed to load org info:', err);
      }
      
      this.loading = false;
    } catch (err: any) {
      console.error('Failed to load org info:', err);
      this.loading = false;
    }
  }

  selectProject(project: Project) {
    this.currentProjectId = project.id;
    // TODO: Store selected project in service/state
    // TODO: Reload data filtered by project
    this.showDropdown = false;
  }
}
