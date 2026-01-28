import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { MeService } from '../../core/services/me.service';

interface ApiKey {
  id: string;
  name: string | null;
  project_id: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface Org {
  id: string;
  name: string;
  trial_ends_at: string | null;
  subscription_status: string;
}

interface Project {
  id: string;
  name: string;
  org_id: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
  apiKeys: ApiKey[] = [];
  org: Org | null = null;
  projects: Project[] = [];
  loading = false;
  error: string | null = null;
  creating = false;
  revoking: string | null = null;
  
  newKeyName = '';
  newKeyProjectId: string | null = null;
  newlyCreatedKey: string | null = null;

  constructor(
    private supabase: SupabaseService,
    private http: HttpClient,
    private authService: AuthService,
    private snackbarService: SnackbarService
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading = true;
    this.error = null;

    try {
      const token = await this.supabase.getAccessToken();
      if (!token) {
        this.error = 'Not authenticated. Please log in.';
        this.loading = false;
        return;
      }

      // Use MeService to prevent duplicate calls
      // Load org info and projects (single call)
      try {
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
        console.error('Failed to load org info:', err);
      }

      // Load API keys (interceptor handles auth)
      try {
        const keys = await this.http.get<ApiKey[]>(`${environment.apiUrl}/auth/api-keys`).toPromise();
        this.apiKeys = keys || [];
      } catch (err: any) {
        if (err.status === 401) {
          this.error = 'Authentication failed. Please log in again.';
        } else {
          this.error = 'Failed to load API keys';
        }
      }

      this.loading = false;
    } catch (err: any) {
      this.error = err.message || 'Failed to load settings';
      this.loading = false;
    }
  }

  async createApiKey() {
    if (this.creating) return;

    this.creating = true;
    this.error = null;

    try {
      const token = await this.supabase.getAccessToken();
      if (!token) {
        this.error = 'Not authenticated';
        this.creating = false;
        return;
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });

      const response = await this.http.post<any>(
        `${environment.apiUrl}/auth/api-keys`,
        {
          name: this.newKeyName || undefined,
          project_id: this.newKeyProjectId || undefined
        },
        { headers }
      ).toPromise();

      this.newlyCreatedKey = response.key;
      this.newKeyName = '';
      this.newKeyProjectId = null;
      
      // Reload API keys list
      await this.loadData();
      
      this.creating = false;
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to create API key';
      this.creating = false;
    }
  }

  async revokeKey(keyId: string) {
    if (this.revoking === keyId) return;
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    this.revoking = keyId;
    this.error = null;

    try {
      const token = await this.supabase.getAccessToken();
      if (!token) {
        this.error = 'Not authenticated';
        this.revoking = null;
        return;
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });

      await this.http.delete(`${environment.apiUrl}/auth/api-keys/${keyId}`, { headers }).toPromise();
      
      // Reload API keys list
      await this.loadData();
      
      this.revoking = null;
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to revoke API key';
      this.revoking = null;
    }
  }

  getProjectName(projectId: string | null): string | null {
    if (!projectId) return null;
    const project = this.projects.find(p => p.id === projectId);
    return project?.name || null;
  }

  copyNewKey() {
    if (this.newlyCreatedKey) {
      navigator.clipboard.writeText(this.newlyCreatedKey).then(() => {
        this.snackbarService.showSuccess('API key copied to clipboard!');
      });
    }
  }

  dismissNewKey() {
    this.newlyCreatedKey = null;
  }
}
