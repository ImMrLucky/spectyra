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

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private baseUrl = environment.apiUrl;
  private adminTokenKey = 'spectyra_admin_token';

  constructor(private http: HttpClient) {}

  /**
   * Get admin token from localStorage
   */
  getAdminToken(): string | null {
    return localStorage.getItem(this.adminTokenKey);
  }

  /**
   * Set admin token in localStorage
   */
  setAdminToken(token: string): void {
    localStorage.setItem(this.adminTokenKey, token);
  }

  /**
   * Clear admin token
   */
  clearAdminToken(): void {
    localStorage.removeItem(this.adminTokenKey);
  }

  /**
   * Check if admin is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getAdminToken();
  }

  /**
   * Get headers with admin token
   */
  private getHeaders(): HttpHeaders {
    const token = this.getAdminToken();
    if (!token) {
      throw new Error('Admin token not found');
    }
    return new HttpHeaders({
      'X-ADMIN-TOKEN': token,
    });
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
}
