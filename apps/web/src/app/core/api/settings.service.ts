import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SupabaseService } from '../../services/supabase.service';

export interface OrgSettings {
  data_retention_days: number;
  store_prompts: boolean;
  store_responses: boolean;
  store_internal_debug: boolean;
  allow_semantic_cache: boolean;
  allowed_ip_ranges: string[] | null;
  enforce_sso: boolean;
  allowed_email_domains: string[] | null;
  provider_key_mode: 'BYOK_ONLY' | 'VAULT_ONLY' | 'EITHER';
}

export interface ProjectSettings {
  allowed_origins: string[] | null;
  rate_limit_rps: number;
  rate_limit_burst: number;
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
  getOrgSettings(orgId: string): Observable<OrgSettings> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.get<OrgSettings>(`${this.baseUrl}/v1/orgs/${orgId}/settings`, { headers })
      )
    );
  }

  /**
   * Update organization settings
   */
  updateOrgSettings(orgId: string, settings: Partial<OrgSettings>): Observable<OrgSettings> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.patch<OrgSettings>(
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
  getProjectSettings(projectId: string): Observable<ProjectSettings> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.get<ProjectSettings>(`${this.baseUrl}/v1/projects/${projectId}/settings`, { headers })
      )
    );
  }

  /**
   * Update project settings
   */
  updateProjectSettings(projectId: string, settings: Partial<ProjectSettings>): Observable<ProjectSettings> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.patch<ProjectSettings>(
          `${this.baseUrl}/v1/projects/${projectId}/settings`,
          settings,
          { headers }
        )
      )
    );
  }
}
