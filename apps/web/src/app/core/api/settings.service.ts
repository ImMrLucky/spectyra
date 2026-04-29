import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SupabaseService } from '../../services/supabase.service';
import type { OrgSettingsDTO, ProjectSettingsDTO } from '@spectyra/shared';

// Re-export DTO types with shorter names for convenience
// These are DTOs (omits IDs and timestamps) for API responses
export type OrgSettings = OrgSettingsDTO;
export type ProjectSettings = ProjectSettingsDTO;

/** Response from PATCH /v1/orgs/:orgId/profile */
export interface OrgProfilePatchResponse {
  success: boolean;
  org: {
    id: string;
    name: string;
    trial_ends_at: string | null;
    subscription_status: string;
    subscription_active?: boolean;
  };
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private supabase: SupabaseService
  ) {}

  private async getHeaders(): Promise<{ [key: string]: string }> {
    const token = await this.supabase.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get organization settings
   */
  getOrgSettings(orgId: string): Observable<OrgSettingsDTO> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ settings: OrgSettingsDTO }>(`${this.baseUrl}/orgs/${orgId}/settings`, { headers }),
      ),
      map((res) => res.settings),
    );
  }

  /**
   * Update organization settings
   */
  updateOrgSettings(orgId: string, settings: Partial<OrgSettingsDTO>): Observable<OrgSettingsDTO> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.patch<{ settings: OrgSettingsDTO }>(
          `${this.baseUrl}/orgs/${orgId}/settings`,
          settings,
          { headers },
        ),
      ),
      map((res) => res.settings),
    );
  }

  /**
   * Update organization display name (workspace label).
   */
  updateOrgProfile(orgId: string, body: { name: string }): Observable<OrgProfilePatchResponse> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.patch<OrgProfilePatchResponse>(`${this.baseUrl}/orgs/${orgId}/profile`, body, { headers }),
      ),
    );
  }

  /**
   * Get project settings
   */
  getProjectSettings(projectId: string): Observable<ProjectSettingsDTO> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ settings: ProjectSettingsDTO }>(
          `${this.baseUrl}/projects/${projectId}/settings`,
          { headers },
        ),
      ),
      map((res) => res.settings),
    );
  }

  /**
   * Update project settings
   */
  updateProjectSettings(
    projectId: string,
    settings: Partial<ProjectSettingsDTO>,
  ): Observable<ProjectSettingsDTO> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.patch<{ settings: ProjectSettingsDTO }>(
          `${this.baseUrl}/projects/${projectId}/settings`,
          settings,
          { headers },
        ),
      ),
      map((res) => res.settings),
    );
  }
}
