import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

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
  template: `
    <div class="container">
      <h1>Settings</h1>
      
      <!-- API Keys Section -->
      <div class="card">
        <h2>API Keys</h2>
        <p class="subtitle">Manage your API keys for gateway access</p>
        
        <div *ngIf="loading" class="loading">Loading...</div>
        
        <div *ngIf="error" class="error-box">
          <p>{{ error }}</p>
        </div>
        
        <!-- Create New API Key -->
        <div class="form-section">
          <h3>Create New API Key</h3>
          <div class="form-group">
            <label for="newKeyName">Key Name</label>
            <input
              type="text"
              id="newKeyName"
              [(ngModel)]="newKeyName"
              placeholder="My API Key"
              class="form-input">
          </div>
          <div class="form-group">
            <label for="newKeyProject">Project (Optional)</label>
            <select id="newKeyProject" [(ngModel)]="newKeyProjectId" class="form-input">
              <option [value]="null">Org-level (all projects)</option>
              <option *ngFor="let project of projects" [value]="project.id">{{ project.name }}</option>
            </select>
          </div>
          <button class="btn btn-primary" (click)="createApiKey()" [disabled]="creating">
            {{ creating ? 'Creating...' : 'Create API Key' }}
          </button>
        </div>
        
        <!-- Display Newly Created Key -->
        <div *ngIf="newlyCreatedKey" class="api-key-box">
          <h3>🎉 API Key Created!</h3>
          <p><strong>Save this key now</strong> - you won't be able to see it again!</p>
          <div class="api-key-display">
            <code>{{ newlyCreatedKey }}</code>
            <button class="btn btn-secondary" (click)="copyNewKey()">Copy</button>
          </div>
          <button class="btn btn-primary" (click)="dismissNewKey()">Done</button>
        </div>
        
        <!-- List of API Keys -->
        <div class="api-keys-list" *ngIf="apiKeys.length > 0">
          <h3>Your API Keys</h3>
          <table class="keys-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Project</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let key of apiKeys">
                <td>{{ key.name || 'Unnamed' }}</td>
                <td>{{ getProjectName(key.project_id) || 'Org-level' }}</td>
                <td>{{ key.created_at | date:'short' }}</td>
                <td>{{ key.last_used_at ? (key.last_used_at | date:'short') : 'Never' }}</td>
                <td>
                  <span [class]="key.revoked_at ? 'status-revoked' : 'status-active'">
                    {{ key.revoked_at ? 'Revoked' : 'Active' }}
                  </span>
                </td>
                <td>
                  <button 
                    class="btn btn-danger btn-sm" 
                    (click)="revokeKey(key.id)"
                    [disabled]="!!key.revoked_at || revoking === key.id">
                    {{ key.revoked_at ? 'Revoked' : 'Revoke' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div *ngIf="apiKeys.length === 0 && !loading" class="empty-state">
          <p>No API keys yet. Create one above to get started.</p>
        </div>
      </div>
      
      <!-- Organization Info -->
      <div class="card" *ngIf="org">
        <h2>Organization</h2>
        <div class="org-info">
          <p><strong>Name:</strong> {{ org.name }}</p>
          <p><strong>Status:</strong> {{ org.subscription_status }}</p>
          <p *ngIf="org.trial_ends_at">
            <strong>Trial ends:</strong> {{ org.trial_ends_at | date:'medium' }}
          </p>
        </div>
      </div>
      
      <!-- Projects Section -->
      <div class="card" *ngIf="projects.length > 0">
        <h2>Projects</h2>
        <ul class="projects-list">
          <li *ngFor="let project of projects">
            <strong>{{ project.name }}</strong>
            <span class="project-id">ID: {{ project.id }}</span>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 40px auto;
      padding: 20px;
    }
    h1 {
      font-size: 32px;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 24px;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .card h2 {
      margin: 0 0 16px;
      font-size: 24px;
    }
    .card h3 {
      margin: 24px 0 16px;
      font-size: 18px;
    }
    .form-section {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e0e0e0;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
    }
    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-primary {
      background: #007bff;
      color: white;
    }
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    .btn-danger {
      background: #dc3545;
      color: white;
    }
    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .api-key-box {
      background: #f8f9fa;
      border: 2px solid #007bff;
      border-radius: 8px;
      padding: 24px;
      margin: 24px 0;
      text-align: center;
    }
    .api-key-display {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 16px;
      margin: 16px 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .api-key-display code {
      flex: 1;
      font-family: monospace;
      font-size: 14px;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      color: #333;
    }
    .keys-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    .keys-table th,
    .keys-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    .keys-table th {
      font-weight: 600;
      background: #f8f9fa;
    }
    .status-active {
      color: #28a745;
      font-weight: 500;
    }
    .status-revoked {
      color: #dc3545;
      font-weight: 500;
    }
    .error-box {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      padding: 12px;
      margin: 16px 0;
      color: #721c24;
    }
    .loading {
      text-align: center;
      padding: 24px;
      color: #666;
    }
    .empty-state {
      text-align: center;
      padding: 24px;
      color: #666;
    }
    .org-info p {
      margin: 8px 0;
    }
    .projects-list {
      list-style: none;
      padding: 0;
    }
    .projects-list li {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .project-id {
      color: #666;
      font-size: 12px;
      font-family: monospace;
    }
  `],
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
    private authService: AuthService
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
      } catch (err: any) {
        console.error('Failed to load org info:', err);
      }

      // Load API keys
      try {
        const keys = await this.http.get<ApiKey[]>(`${environment.apiUrl}/auth/api-keys`, { headers }).toPromise();
        this.apiKeys = keys || [];
      } catch (err: any) {
        if (err.status === 401) {
          this.error = 'Authentication failed. Please log in again.';
        } else {
          this.error = 'Failed to load API keys';
        }
      }

      // Load projects (if endpoint exists)
      // TODO: Add projects endpoint or get from org info

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
        alert('API key copied to clipboard!');
      });
    }
  }

  dismissNewKey() {
    this.newlyCreatedKey = null;
  }
}
