import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SupabaseService } from '../../services/supabase.service';
import type { OrgSettingsDTO, ProjectSettingsDTO } from '@spectyra/shared';

// Re-export DTO types with shorter names for convenience
// These are DTOs (omits IDs and timestamps) for API responses
export type OrgSettings = OrgSettingsDTO;
export type ProjectSettings = ProjectSettingsDTO;

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
      switchMap(headers =>
        this.http.get<OrgSettingsDTO>(`${this.baseUrl}/v1/orgs/${orgId}/settings`, { headers })
      )
    );
  }

  /**
   * Update organization settings
   */
  updateOrgSettings(orgId: string, settings: Partial<OrgSettingsDTO>): Observable<OrgSettingsDTO> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.patch<OrgSettingsDTO>(
          `${this.baseUrl}/v1/orgs/${orgId}/settings`,
          settings,
          { headers }
        )
      )
    );
  }

  /**
   * Get project settings
   */
  getProjectSettings(projectId: string): Observable<ProjectSettingsDTO> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.get<ProjectSettingsDTO>(`${this.baseUrl}/v1/projects/${projectId}/settings`, { headers })
      )
    );
  }

  /**
   * Update project settings
   */
  updateProjectSettings(projectId: string, settings: Partial<ProjectSettingsDTO>): Observable<ProjectSettingsDTO> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.patch<ProjectSettingsDTO>(
          `${this.baseUrl}/v1/projects/${projectId}/settings`,
          settings,
          { headers }
        )
      )
    );
  }
}
