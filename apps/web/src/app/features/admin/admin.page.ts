import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminService, AdminOrg, AdminOrgDetail, AdminUser } from '../../core/api/admin.service';
import { SupabaseService } from '../../services/supabase.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { AuthService } from '../../core/auth/auth.service';
import {MatIcon} from "@angular/material/icon";

@Component({
  selector: 'app-admin',
  standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, MatIcon],
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage implements OnInit {
  isOwner = false;
  isAuthenticated = false;
  
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

  // SDK Access
  togglingSdkAccess = false;

  // User Management
  activeTab: 'orgs' | 'users' = 'orgs';
  users: AdminUser[] = [];
  loadingUsers = false;

  constructor(
    private adminService: AdminService,
    private supabase: SupabaseService,
    private snackbar: SnackbarService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Check if user is authenticated
    this.supabase.getSession().subscribe(session => {
      this.isAuthenticated = !!session;
      if (session) {
        this.checkOwnerAndLoad();
      } else {
        this.isOwner = false;
        this.error = 'Please log in to access admin panel';
      }
    });
  }

  checkOwnerAndLoad() {
    // Try to load orgs - if successful, user is owner
    this.loading = true;
    this.adminService.listOrgs().subscribe({
      next: (response) => {
        this.isOwner = true;
        this.orgs = response.orgs;
        this.loading = false;
        this.error = null;
      },
      error: (err) => {
        this.isOwner = false;
        this.loading = false;
        if (err.status === 403) {
          this.error = 'Access denied: Owner only. You must be logged in as gkh1974@gmail.com';
        } else {
          this.error = err.error?.error || 'Failed to verify owner status';
        }
      },
    });
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

  toggleSdkAccess(enabled: boolean) {
    if (!this.selectedOrg) return;

    this.togglingSdkAccess = true;
    this.adminService.toggleSdkAccess(this.selectedOrg.id, enabled).subscribe({
      next: (response) => {
        this.orgDetails = { ...this.orgDetails!, ...response.org };
        this.selectedOrg = response.org;
        // Update in list
        const index = this.orgs.findIndex(o => o.id === response.org.id);
        if (index >= 0) {
          this.orgs[index] = response.org;
        }
        this.togglingSdkAccess = false;
        this.snackbar.showSuccess(response.message);
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to update SDK access';
        this.togglingSdkAccess = false;
        this.snackbar.showError(this.error || 'An error occurred');
      },
    });
  }

  async logout() {
    // Logout from both Supabase and clear API key
    await this.supabase.signOut();
    this.authService.logout();
    
    // Clear all Supabase-related localStorage items
    const supabaseKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') || key.includes('supabase')
    );
    supabaseKeys.forEach(key => localStorage.removeItem(key));
    
    // Redirect to login page
    this.router.navigate(['/login']);
  }

  switchTab(tab: 'orgs' | 'users') {
    this.activeTab = tab;
    if (tab === 'users' && this.users.length === 0) {
      this.loadUsers();
    }
  }

  loadUsers() {
    this.loadingUsers = true;
    this.adminService.listUsers().subscribe({
      next: (response) => {
        this.users = response.users;
        this.loadingUsers = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load users';
        this.loadingUsers = false;
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
