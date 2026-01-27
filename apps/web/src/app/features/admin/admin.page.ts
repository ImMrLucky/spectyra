import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminOrg, AdminOrgDetail } from '../../core/api/admin.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.css'],
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
