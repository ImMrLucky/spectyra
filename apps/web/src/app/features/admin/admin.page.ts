import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminOrg, AdminOrgDetail } from '../../core/api/admin.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h1>Admin Panel</h1>
        <div class="auth-section" *ngIf="!isAuthenticated">
          <p>Enter admin token to access:</p>
          <div class="auth-form">
            <input
              type="password"
              [(ngModel)]="adminToken"
              placeholder="Admin Token"
              class="token-input"
              (keyup.enter)="login()"
            />
            <button (click)="login()" [disabled]="!adminToken || loggingIn" class="btn btn-primary">
              {{ loggingIn ? 'Logging in...' : 'Login' }}
            </button>
          </div>
          <p class="error" *ngIf="authError">{{ authError }}</p>
        </div>
        <div class="auth-section" *ngIf="isAuthenticated">
          <button (click)="logout()" class="btn btn-secondary">Logout</button>
        </div>
      </div>

      <div *ngIf="isAuthenticated" class="admin-content">
        <!-- Org List -->
        <div class="section">
          <h2>Organizations</h2>
          <div class="loading" *ngIf="loading">
            <p>Loading organizations...</p>
          </div>
          <div class="error" *ngIf="error">{{ error }}</div>
          
          <div class="org-list" *ngIf="!loading && !error && orgs.length > 0">
            <div class="org-card" *ngFor="let org of orgs" [class.selected]="selectedOrg?.id === org.id">
              <div class="org-header" (click)="selectOrg(org.id)">
                <div class="org-info">
                  <h3>{{ org.name }}</h3>
                  <p class="org-id">ID: {{ org.id }}</p>
                  <div class="org-meta">
                    <span class="badge" [class.active]="org.subscription_status === 'active'"
                          [class.trial]="org.subscription_status === 'trial'">
                      {{ org.subscription_status }}
                    </span>
                    <span class="created">Created: {{ formatDate(org.created_at) }}</span>
                  </div>
                </div>
                <div class="org-stats" *ngIf="org.stats">
                  <div class="stat">
                    <span class="stat-label">Projects:</span>
                    <span class="stat-value">{{ org.stats.projects }}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">API Keys:</span>
                    <span class="stat-value">{{ org.stats.api_keys }}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Runs:</span>
                    <span class="stat-value">{{ org.stats.runs }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="empty" *ngIf="!loading && !error && orgs.length === 0">
            <p>No organizations found</p>
          </div>
        </div>

        <!-- Org Details -->
        <div class="section" *ngIf="selectedOrg">
          <h2>Organization Details</h2>
          <div class="loading" *ngIf="loadingDetails">
            <p>Loading details...</p>
          </div>
          
          <div class="org-details" *ngIf="!loadingDetails && orgDetails">
            <div class="detail-group">
              <label>Name:</label>
              <div class="edit-name">
                <input
                  type="text"
                  [(ngModel)]="editName"
                  class="name-input"
                  *ngIf="editingName"
                />
                <span *ngIf="!editingName">{{ orgDetails.name }}</span>
                <div class="edit-actions" *ngIf="editingName">
                  <button (click)="saveName()" [disabled]="saving" class="btn btn-sm btn-primary">
                    {{ saving ? 'Saving...' : 'Save' }}
                  </button>
                  <button (click)="cancelEdit()" [disabled]="saving" class="btn btn-sm btn-secondary">
                    Cancel
                  </button>
                </div>
                <button (click)="startEdit()" *ngIf="!editingName" class="btn btn-sm btn-secondary">
                  Edit
                </button>
              </div>
            </div>
            
            <div class="detail-group">
              <label>ID:</label>
              <span>{{ orgDetails.id }}</span>
            </div>
            
            <div class="detail-group">
              <label>Status:</label>
              <span class="badge" [class.active]="orgDetails.subscription_status === 'active'"
                    [class.trial]="orgDetails.subscription_status === 'trial'">
                {{ orgDetails.subscription_status }}
              </span>
            </div>
            
            <div class="detail-group">
              <label>Trial Ends:</label>
              <span>{{ orgDetails.trial_ends_at ? formatDate(orgDetails.trial_ends_at) : 'N/A' }}</span>
            </div>
            
            <div class="detail-group">
              <label>Created:</label>
              <span>{{ formatDate(orgDetails.created_at) }}</span>
            </div>

            <div class="detail-group" *ngIf="orgDetails.stats">
              <label>Statistics:</label>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">Projects:</span>
                  <span class="stat-value">{{ orgDetails.stats.projects }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">API Keys:</span>
                  <span class="stat-value">{{ orgDetails.stats.api_keys }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Runs:</span>
                  <span class="stat-value">{{ orgDetails.stats.runs }}</span>
                </div>
              </div>
            </div>

            <div class="detail-group" *ngIf="orgDetails.projects && orgDetails.projects.length > 0">
              <label>Projects:</label>
              <ul class="project-list">
                <li *ngFor="let project of orgDetails.projects">
                  {{ project.name }} <span class="project-id">({{ project.id }})</span>
                </li>
              </ul>
            </div>

            <div class="detail-group" *ngIf="orgDetails.api_keys && orgDetails.api_keys.length > 0">
              <label>API Keys:</label>
              <ul class="api-key-list">
                <li *ngFor="let key of orgDetails.api_keys">
                  <span>{{ key.name || 'Unnamed' }}</span>
                  <span class="key-meta">
                    Created: {{ formatDate(key.created_at) }}
                    <span *ngIf="key.revoked_at" class="revoked">(Revoked)</span>
                  </span>
                </li>
              </ul>
            </div>

            <div class="danger-zone">
              <h3>Danger Zone</h3>
              <p class="warning">Deleting an organization will permanently remove all associated data including projects, API keys, runs, and savings data. This action cannot be undone.</p>
              <button (click)="confirmDelete()" [disabled]="deleting" class="btn btn-danger">
                {{ deleting ? 'Deleting...' : 'Delete Organization' }}
              </button>
              <div class="delete-confirm" *ngIf="showDeleteConfirm">
                <p>Are you sure you want to delete "{{ orgDetails.name }}"?</p>
                <div class="confirm-actions">
                  <button (click)="deleteOrg()" [disabled]="deleting" class="btn btn-danger">
                    {{ deleting ? 'Deleting...' : 'Yes, Delete' }}
                  </button>
                  <button (click)="cancelDelete()" [disabled]="deleting" class="btn btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      color: #333;
    }
    .auth-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .auth-form {
      display: flex;
      gap: 10px;
    }
    .token-input {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      min-width: 300px;
    }
    .section {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .section h2 {
      margin: 0 0 20px 0;
      font-size: 24px;
      color: #333;
    }
    .org-list {
      display: grid;
      gap: 16px;
    }
    .org-card {
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .org-card:hover {
      border-color: #007bff;
      box-shadow: 0 2px 8px rgba(0,123,255,0.1);
    }
    .org-card.selected {
      border-color: #007bff;
      background: #f0f7ff;
    }
    .org-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
    }
    .org-info h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #333;
    }
    .org-id {
      font-family: monospace;
      font-size: 12px;
      color: #666;
      margin: 4px 0;
    }
    .org-meta {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-top: 8px;
    }
    .badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge.active {
      background: #4caf50;
      color: white;
    }
    .badge.trial {
      background: #2196f3;
      color: white;
    }
    .created {
      font-size: 12px;
      color: #666;
    }
    .org-stats {
      display: flex;
      gap: 20px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: #333;
    }
    .org-details {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .detail-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .detail-group label {
      font-weight: 600;
      color: #333;
    }
    .edit-name {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .name-input {
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      flex: 1;
      max-width: 400px;
    }
    .edit-actions {
      display: flex;
      gap: 8px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .project-list, .api-key-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .project-list li, .api-key-list li {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .project-id, .key-meta {
      font-size: 12px;
      color: #666;
      margin-left: 8px;
    }
    .revoked {
      color: #f44336;
    }
    .danger-zone {
      margin-top: 30px;
      padding: 20px;
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
    }
    .danger-zone h3 {
      margin: 0 0 12px 0;
      color: #856404;
    }
    .warning {
      color: #856404;
      margin-bottom: 16px;
    }
    .delete-confirm {
      margin-top: 16px;
      padding: 16px;
      background: white;
      border-radius: 4px;
    }
    .confirm-actions {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-primary {
      background: #007bff;
      color: white;
    }
    .btn-primary:hover:not(:disabled) {
      background: #0056b3;
    }
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    .btn-secondary:hover:not(:disabled) {
      background: #545b62;
    }
    .btn-danger {
      background: #dc3545;
      color: white;
    }
    .btn-danger:hover:not(:disabled) {
      background: #c82333;
    }
    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }
    .loading, .error, .empty {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    .error {
      color: #dc3545;
    }
  `],
})
export class AdminPage implements OnInit {
  isAuthenticated = false;
  adminToken = '';
  loggingIn = false;
  authError: string | null = null;
  
  orgs: AdminOrg[] = [];
  loading = false;
  error: string | null = null;
  
  selectedOrg: AdminOrg | null = null;
  orgDetails: AdminOrgDetail | null = null;
  loadingDetails = false;
  
  editingName = false;
  editName = '';
  saving = false;
  
  deleting = false;
  showDeleteConfirm = false;

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.isAuthenticated = this.adminService.isAuthenticated();
    if (this.isAuthenticated) {
      this.loadOrgs();
    }
  }

  login() {
    if (!this.adminToken) {
      this.authError = 'Please enter an admin token';
      return;
    }

    this.loggingIn = true;
    this.authError = null;
    this.adminService.setAdminToken(this.adminToken);
    
    // Test the token by trying to list orgs
    this.adminService.listOrgs().subscribe({
      next: () => {
        this.isAuthenticated = true;
        this.loggingIn = false;
        this.loadOrgs();
      },
      error: (err) => {
        this.adminService.clearAdminToken();
        this.isAuthenticated = false;
        this.loggingIn = false;
        if (err.status === 403) {
          this.authError = 'Invalid admin token';
        } else {
          this.authError = 'Failed to authenticate: ' + (err.error?.error || 'Unknown error');
        }
      },
    });
  }

  logout() {
    this.adminService.clearAdminToken();
    this.isAuthenticated = false;
    this.orgs = [];
    this.selectedOrg = null;
    this.orgDetails = null;
    this.adminToken = '';
  }

  loadOrgs() {
    this.loading = true;
    this.error = null;
    
    this.adminService.listOrgs().subscribe({
      next: (response) => {
        this.orgs = response.orgs;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load organizations';
        this.loading = false;
        if (err.status === 403) {
          this.logout();
        }
      },
    });
  }

  selectOrg(orgId: string) {
    this.selectedOrg = this.orgs.find(o => o.id === orgId) || null;
    this.loadOrgDetails(orgId);
  }

  loadOrgDetails(orgId: string) {
    this.loadingDetails = true;
    this.orgDetails = null;
    
    this.adminService.getOrg(orgId).subscribe({
      next: (details) => {
        this.orgDetails = details;
        this.editName = details.name;
        this.loadingDetails = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load organization details';
        this.loadingDetails = false;
      },
    });
  }

  startEdit() {
    this.editingName = true;
    this.editName = this.orgDetails?.name || '';
  }

  cancelEdit() {
    this.editingName = false;
    this.editName = this.orgDetails?.name || '';
  }

  saveName() {
    if (!this.selectedOrg || !this.editName.trim()) {
      return;
    }

    this.saving = true;
    this.adminService.updateOrg(this.selectedOrg.id, this.editName.trim()).subscribe({
      next: (response) => {
        this.orgDetails = { ...this.orgDetails!, ...response.org };
        this.selectedOrg = response.org;
        // Update in list
        const index = this.orgs.findIndex(o => o.id === response.org.id);
        if (index >= 0) {
          this.orgs[index] = response.org;
        }
        this.editingName = false;
        this.saving = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to update organization';
        this.saving = false;
      },
    });
  }

  confirmDelete() {
    this.showDeleteConfirm = true;
  }

  cancelDelete() {
    this.showDeleteConfirm = false;
  }

  deleteOrg() {
    if (!this.selectedOrg) {
      return;
    }

    this.deleting = true;
    this.adminService.deleteOrg(this.selectedOrg.id).subscribe({
      next: () => {
        // Remove from list
        this.orgs = this.orgs.filter(o => o.id !== this.selectedOrg!.id);
        this.selectedOrg = null;
        this.orgDetails = null;
        this.showDeleteConfirm = false;
        this.deleting = false;
      },
      error: (err) => {
        this.error = err.error?.error || err.error?.message || 'Failed to delete organization';
        this.deleting = false;
      },
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
