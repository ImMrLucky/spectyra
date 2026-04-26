import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminOrg {
  id: string;
  name: string;
  created_at: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  subscription_status: 'trial' | 'active' | 'canceled' | 'past_due';
  sdk_access_enabled: boolean;
  /** Org-wide API/chat bypass (set from superuser console). */
  platform_exempt?: boolean;
  /** Superuser savings tri-state (null = billing default). */
  observe_only_override?: boolean | null;
  stats?: {
    projects: number;
    api_keys: number;
    runs: number;
  };
}

export interface AdminOrgDetail extends AdminOrg {
  projects: Array<{
    id: string;
    name: string;
    created_at: string;
  }>;
  api_keys: Array<{
    id: string;
    name: string | null;
    project_id: string | null;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
  }>;
  stats: {
    projects: number;
    api_keys: number;
    runs: number;
  };
}

export type AccountAccessState = 'active' | 'paused' | 'inactive';

export interface AdminUser {
  user_id: string;
  email?: string;
  /** active = normal; paused = Stripe paused + grace then JWT read-only; inactive = Observe savings lock on owned orgs */
  access_state?: AccountAccessState;
  /** While paused: full app/savings until this ISO time; then read-only until reactivated */
  pause_savings_until?: string | null;
  /** Platform role from platform_roles table (null = regular user) */
  platform_role?: string | null;
  /** Oldest owned org — used for staff billing exempt toggle */
  primary_owner_org?: { org_id: string; platform_exempt: boolean } | null;
  orgs: Array<{
    org_id: string;
    org_name: string;
    role: string;
    created_at: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get headers with Supabase JWT (for owner-based admin)
   * Admin endpoints now use requireUserSession + requireOwner
   */
  private getHeaders(): HttpHeaders {
    // Headers are automatically added by auth interceptor
    // This method is kept for backward compatibility but doesn't add admin token
    return new HttpHeaders();
  }

  /**
   * Check if user is owner (admin access)
   * This is now checked server-side via requireOwner middleware
   */
  isAuthenticated(): boolean {
    // Owner check happens server-side
    // We can't reliably check client-side without exposing owner email
    // So we'll try to access admin endpoints and handle 403 errors
    return true; // Will be validated by server
  }

  /**
   * List all organizations
   */
  listOrgs(): Observable<{ orgs: AdminOrg[] }> {
    return this.http.get<{ orgs: AdminOrg[] }>(`${this.baseUrl}/admin/orgs`, {
      headers: this.getHeaders(),
    });
  }

  /**
   * Get organization details
   */
  getOrg(orgId: string): Observable<AdminOrgDetail> {
    return this.http.get<AdminOrgDetail>(`${this.baseUrl}/admin/orgs/${orgId}`, {
      headers: this.getHeaders(),
    });
  }

  /**
   * Update organization
   */
  updateOrg(orgId: string, name: string): Observable<{ org: AdminOrg }> {
    return this.http.patch<{ org: AdminOrg }>(
      `${this.baseUrl}/admin/orgs/${orgId}`,
      { name },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Delete organization
   */
  deleteOrg(orgId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.baseUrl}/admin/orgs/${orgId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Toggle SDK access for an organization
   */
  toggleSdkAccess(orgId: string, enabled: boolean): Observable<{ org: AdminOrg; message: string }> {
    return this.http.patch<{ org: AdminOrg; message: string }>(
      `${this.baseUrl}/admin/orgs/${orgId}/sdk-access`,
      { enabled },
      { headers: this.getHeaders() }
    );
  }

  /**
   * List all users with their org memberships
   */
  listUsers(): Observable<{ users: AdminUser[] }> {
    return this.http.get<{ users: AdminUser[] }>(`${this.baseUrl}/admin/users`, {
      headers: this.getHeaders(),
    });
  }

  /** Superuser / platform owner only — who may manage roles and owner-org billing exempt */
  getCapabilities(): Observable<{
    can_manage_platform_roles: boolean;
    can_manage_owner_org_billing: boolean;
  }> {
    return this.http.get<{
      can_manage_platform_roles: boolean;
      can_manage_owner_org_billing: boolean;
    }>(`${this.baseUrl}/admin/capabilities`, { headers: this.getHeaders() });
  }

  /** Owner admin: `{ snapshot, registry }` — snapshot matches machine catalog; registry = source + stale. */
  getPricingSnapshot(provider?: string): Observable<{
    snapshot: Record<string, unknown>;
    registry: { source: string; stale: boolean; ingestedAt?: string; overrideCount?: number };
  }> {
    const q = provider ? `?provider=${encodeURIComponent(provider)}` : '';
    return this.http.get<{
      snapshot: Record<string, unknown>;
      registry: { source: string; stale: boolean; ingestedAt?: string; overrideCount?: number };
    }>(`${this.baseUrl}/admin/pricing/snapshot${q}`, {
      headers: this.getHeaders(),
    });
  }

  getPricingRegistryStatus(): Observable<{
    catalogSource: string;
    stale: boolean;
    version: string | null;
    ingestedAt: string | null;
    overrideCount: number;
  }> {
    return this.http.get<{
      catalogSource: string;
      stale: boolean;
      version: string | null;
      ingestedAt: string | null;
      overrideCount: number;
    }>(`${this.baseUrl}/admin/pricing/status`, { headers: this.getHeaders() });
  }

  ingestBundledPricing(): Observable<{ ok: boolean; version: string }> {
    return this.http.post<{ ok: boolean; version: string }>(
      `${this.baseUrl}/admin/pricing/ingest-bundled`,
      {},
      { headers: this.getHeaders() },
    );
  }

  listPricingOverrides(): Observable<{
    overrides: Array<{
      id: string;
      org_id: string | null;
      model_id: string;
      patch_json: Record<string, unknown>;
      updated_at: string;
    }>;
  }> {
    return this.http.get<{
      overrides: Array<{
        id: string;
        org_id: string | null;
        model_id: string;
        patch_json: Record<string, unknown>;
        updated_at: string;
      }>;
    }>(`${this.baseUrl}/admin/pricing/overrides`, { headers: this.getHeaders() });
  }

  upsertPricingOverride(body: {
    orgId?: string | null;
    modelId: string;
    patch: Record<string, unknown>;
  }): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.baseUrl}/admin/pricing/overrides`, body, {
      headers: this.getHeaders(),
    });
  }

  deletePricingOverride(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.baseUrl}/admin/pricing/overrides?id=${encodeURIComponent(id)}`,
      { headers: this.getHeaders() },
    );
  }

  /** Pause / inactive / reactivate — see API docs for semantics */
  setUserAccess(
    userId: string,
    access_state: AccountAccessState,
  ): Observable<{
    user_id: string;
    access_state: AccountAccessState;
    pause_savings_until: string | null;
    stripe: {
      subscriptionIdsPaused: string[];
      subscriptionIdsResumed: string[];
      orgIds: string[];
      warnings: string[];
    };
  }> {
    return this.http.patch<{
      user_id: string;
      access_state: AccountAccessState;
      pause_savings_until: string | null;
      stripe: {
        subscriptionIdsPaused: string[];
        subscriptionIdsResumed: string[];
        orgIds: string[];
        warnings: string[];
      };
    }>(`${this.baseUrl}/admin/users/${encodeURIComponent(userId)}/access`, { access_state }, { headers: this.getHeaders() });
  }

  /** Staff / special users: full entitlement without paid subscription (first owned org). Superuser / owner email only. */
  setOwnerOrgPlatformExempt(
    userId: string,
    platform_exempt: boolean,
  ): Observable<{ user_id: string; org_id: string; platform_exempt: boolean }> {
    return this.http.patch<{ user_id: string; org_id: string; platform_exempt: boolean }>(
      `${this.baseUrl}/admin/users/${encodeURIComponent(userId)}/owner-org-billing`,
      { platform_exempt },
      { headers: this.getHeaders() },
    );
  }

  /** Grant or revoke admin platform role */
  setUserRole(
    userId: string,
    role: 'admin' | null,
  ): Observable<{ user_id: string; email: string; platform_role: string | null }> {
    return this.http.patch<{ user_id: string; email: string; platform_role: string | null }>(
      `${this.baseUrl}/admin/users/${encodeURIComponent(userId)}/role`,
      { role },
      { headers: this.getHeaders() },
    );
  }

  /** Remove app data + Supabase Auth user (owner / superuser only) */
  deleteUser(userId: string): Observable<{
    deleted: boolean;
    user_id: string;
    orgs_deleted: string[];
    memberships_removed: number;
  }> {
    return this.http.delete<{
      deleted: boolean;
      user_id: string;
      orgs_deleted: string[];
      memberships_removed: number;
    }>(`${this.baseUrl}/admin/users/${encodeURIComponent(userId)}`, { headers: this.getHeaders() });
  }
}
