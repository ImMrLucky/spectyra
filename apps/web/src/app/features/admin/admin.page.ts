import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminService, AdminOrg, AdminOrgDetail, AdminUser, AccountAccessState } from '../../core/api/admin.service';
import { SupabaseService } from '../../services/supabase.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { AuthService } from '../../core/auth/auth.service';
import { WorkspacePlanContextService } from '../../core/services/workspace-plan-context.service';
import {MatIcon} from "@angular/material/icon";
import { Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-admin',
  standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, MatIcon],
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage implements OnInit, OnDestroy {
  isOwner = false;
  isAuthenticated = false;
  
  orgs: AdminOrg[] = [];
  loading = false;
  /** Shown in header when logged in but not allowed to use admin */
  accessMessage: string | null = null;
  /** Org list fetch only — must not hide list when detail actions fail */
  orgsListError: string | null = null;
  /** Organization details panel */
  orgDetailsError: string | null = null;
  /** Users tab */
  usersError: string | null = null;
  
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
  userActionBusy: string | null = null;
  deleteConfirmUserId: string | null = null;
  canManageRoles = false;
  /** platform_exempt on user's first owned org — superuser / platform owner only */
  canManageOwnerOrgBilling = false;

  private sessionSub?: Subscription;
  private listOrgsSub?: Subscription;

  constructor(
    private adminService: AdminService,
    private supabase: SupabaseService,
    private snackbar: SnackbarService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private workspacePlan: WorkspacePlanContextService,
  ) {}

  ngOnInit() {
    // onAuthStateChange emits TOKEN_REFRESHED etc. — same user id must not re-run load or we
    // flash loading=false→true and can flip isOwner false on a transient failed retry.
    this.sessionSub = this.supabase
      .getSession()
      .pipe(
        distinctUntilChanged(
          (a, b) =>
            (a?.user?.id ?? '') === (b?.user?.id ?? '') && !!a === !!b,
        ),
      )
      .subscribe((session) => {
        this.isAuthenticated = !!session;
        if (session) {
          this.checkOwnerAndLoad();
        } else {
          this.isOwner = false;
          this.accessMessage = null;
          this.orgs = [];
          this.users = [];
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.sessionSub?.unsubscribe();
    this.listOrgsSub?.unsubscribe();
  }

  checkOwnerAndLoad() {
    this.listOrgsSub?.unsubscribe();
    this.loading = true;
    this.orgsListError = null;
    this.accessMessage = null;
    this.listOrgsSub = this.adminService.listOrgs().subscribe({
      next: (response) => {
        const list = response?.orgs;
        this.isOwner = true;
        this.orgs = Array.isArray(list) ? list : [];
        this.loading = false;
        this.accessMessage = null;
        this.orgsListError = null;
        this.adminService.getCapabilities().subscribe({
          next: (c) => {
            this.canManageRoles = !!c?.can_manage_platform_roles;
            this.canManageOwnerOrgBilling = !!c?.can_manage_owner_org_billing;
            this.cdr.markForCheck();
          },
          error: () => {
            this.canManageRoles = false;
            this.canManageOwnerOrgBilling = false;
            this.cdr.markForCheck();
          },
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isOwner = false;
        this.loading = false;
        if (err.status === 403) {
          this.accessMessage = 'Access denied: Owner only.';
        } else {
          this.accessMessage = err.error?.error || 'Failed to verify owner status';
        }
        this.cdr.markForCheck();
      },
    });
  }

  loadOrgs() {
    this.loading = true;
    this.orgsListError = null;

    this.adminService.listOrgs().subscribe({
      next: (response) => {
        const list = response?.orgs;
        this.orgs = Array.isArray(list) ? list : [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.orgsListError = err.error?.error || 'Failed to load organizations';
        this.loading = false;
        if (err.status === 403) {
          this.logout();
        }
        this.cdr.markForCheck();
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
    this.orgDetailsError = null;

    this.adminService.getOrg(orgId).subscribe({
      next: (details) => {
        this.orgDetails = details;
        this.editName = details.name;
        this.loadingDetails = false;
      },
      error: (err) => {
        this.orgDetailsError = err.error?.error || 'Failed to load organization details';
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
        this.orgDetailsError = err.error?.error || 'Failed to update organization';
        this.saving = false;
        this.snackbar.showError(this.orgDetailsError ?? 'Failed to update organization');
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
        this.orgDetailsError = err.error?.error || err.error?.message || 'Failed to delete organization';
        this.deleting = false;
        this.snackbar.showError(this.orgDetailsError ?? 'Failed to delete organization');
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
        this.togglingSdkAccess = false;
        const msg = err.error?.error || 'Failed to update SDK access';
        this.snackbar.showError(msg);
      },
    });
  }

  async logout() {
    // Logout from both Supabase and clear API key
    await this.supabase.signOut();
    this.authService.logout();
    this.workspacePlan.clear();

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
    if (tab === 'users' && this.users.length === 0 && !this.loadingUsers) {
      this.loadUsers();
    }
  }

  loadUsers() {
    this.loadingUsers = true;
    this.usersError = null;
    this.adminService.listUsers().subscribe({
      next: (response) => {
        const raw = response?.users;
        const list = Array.isArray(raw) ? raw : [];
        this.users = list.map((u) => ({
          ...u,
          orgs: Array.isArray(u.orgs) ? u.orgs : [],
        }));
        this.loadingUsers = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.usersError = err.error?.error || 'Failed to load users';
        this.loadingUsers = false;
        this.cdr.markForCheck();
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

  setUserAccess(user: AdminUser, state: AccountAccessState) {
    this.userActionBusy = user.user_id;
    this.adminService.setUserAccess(user.user_id, state).subscribe({
      next: (r) => {
        user.access_state = r.access_state;
        user.pause_savings_until = r.pause_savings_until;
        this.userActionBusy = null;
        if (state === 'paused') {
          const until = r.pause_savings_until
            ? new Date(r.pause_savings_until).toLocaleString()
            : '';
          let msg = until
            ? `Paused: Stripe collection stopped. Full app savings access until ${until}, then read-only until reactivated.`
            : 'Paused: Stripe updated. Savings grace applied.';
          if (r.stripe?.warnings?.length) {
            msg += ` Stripe: ${r.stripe.warnings.join('; ')}`;
          }
          this.snackbar.showSuccess(msg);
        } else if (state === 'inactive') {
          this.snackbar.showSuccess(
            'Set to Inactive: real savings stay in Observe mode on owned orgs until they subscribe (app use is not blocked).',
          );
        } else {
          this.snackbar.showSuccess(
            r.stripe?.warnings?.length
              ? `Updated. ${r.stripe.warnings.join('; ')}`
              : 'User set to Active; Stripe collection resumed where applicable.',
          );
        }
      },
      error: (err) => {
        this.userActionBusy = null;
        this.snackbar.showError(err.error?.error || 'Failed to update user');
      },
    });
  }

  /** Paused user still in 30-day full-access window */
  isSavingsGrace(user: AdminUser): boolean {
    if (user.access_state !== 'paused' || !user.pause_savings_until) return false;
    return new Date(user.pause_savings_until) > new Date();
  }

  /** Default missing flag row = active */
  isAccessActive(user: AdminUser): boolean {
    return !user.access_state || user.access_state === 'active';
  }

  toggleOwnerOrgBilling(user: AdminUser, exempt: boolean) {
    if (!user.primary_owner_org) {
      this.snackbar.showError('User has no owned organization.');
      return;
    }
    this.userActionBusy = user.user_id;
    this.adminService.setOwnerOrgPlatformExempt(user.user_id, exempt).subscribe({
      next: (r) => {
        user.primary_owner_org = { org_id: r.org_id, platform_exempt: r.platform_exempt };
        this.userActionBusy = null;
        this.snackbar.showSuccess(
          r.platform_exempt
            ? 'Billing exempt enabled on their primary owned org (full access without a paid subscription).'
            : 'Billing exempt removed; normal subscription rules apply.',
        );
      },
      error: (err) => {
        this.userActionBusy = null;
        this.snackbar.showError(err.error?.error || 'Failed to update billing exempt');
      },
    });
  }

  toggleAdmin(user: AdminUser) {
    const isCurrentlyAdmin = user.platform_role === 'admin';
    const newRole = isCurrentlyAdmin ? null : 'admin';
    this.userActionBusy = user.user_id;
    this.adminService.setUserRole(user.user_id, newRole).subscribe({
      next: (r) => {
        user.platform_role = r.platform_role;
        this.userActionBusy = null;
        this.snackbar.showSuccess(
          r.platform_role === 'admin'
            ? `${r.email} is now an Admin.`
            : `Admin access removed for ${r.email}.`,
        );
      },
      error: (err) => {
        this.userActionBusy = null;
        this.snackbar.showError(err.error?.error || 'Failed to update role');
      },
    });
  }

  askDeleteUser(user: AdminUser) {
    this.deleteConfirmUserId = user.user_id;
  }

  cancelDeleteUser() {
    this.deleteConfirmUserId = null;
  }

  deleteUser(user: AdminUser) {
    this.userActionBusy = user.user_id;
    this.adminService.deleteUser(user.user_id).subscribe({
      next: (r) => {
        this.users = this.users.filter((u) => u.user_id !== user.user_id);
        this.deleteConfirmUserId = null;
        this.userActionBusy = null;
        const od = r.orgs_deleted?.length ? ` Orgs removed: ${r.orgs_deleted.length}.` : '';
        this.snackbar.showSuccess(`User deleted.${od}`);
      },
      error: (err) => {
        this.userActionBusy = null;
        this.snackbar.showError(err.error?.error || 'Failed to delete user');
      },
    });
  }
}
