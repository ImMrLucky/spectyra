import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SupabaseService } from '../../services/supabase.service';

export interface ProviderCredential {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'aws';
  key_fingerprint: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

export interface ProviderKeyMode {
  provider_key_mode: 'BYOK_ONLY' | 'VAULT_ONLY' | 'EITHER';
}

@Injectable({
  providedIn: 'root',
})
export class ProviderKeysService {
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
   * List provider credentials (masked)
   */
  listProviderKeys(orgId: string): Observable<ProviderCredential[]> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.get<ProviderCredential[]>(`${this.baseUrl}/v1/orgs/${orgId}/provider-keys`, { headers })
      )
    );
  }

  /**
   * Set/update provider key
   */
  setProviderKey(orgId: string, provider: string, key: string, projectId?: string | null): Observable<ProviderCredential> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.post<ProviderCredential>(
          `${this.baseUrl}/v1/orgs/${orgId}/provider-keys`,
          {
            provider,
            key,
            project_id: projectId || null,
          },
          { headers }
        )
      )
    );
  }

  /**
   * Revoke provider key
   */
  revokeProviderKey(orgId: string, credentialId: string): Observable<void> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.delete<void>(`${this.baseUrl}/v1/orgs/${orgId}/provider-keys/${credentialId}`, { headers })
      )
    );
  }

  /**
   * Get provider key mode
   */
  getProviderKeyMode(orgId: string): Observable<ProviderKeyMode> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.get<ProviderKeyMode>(`${this.baseUrl}/v1/orgs/${orgId}/provider-key-mode`, { headers })
      )
    );
  }

  /**
   * Update provider key mode
   */
  updateProviderKeyMode(orgId: string, mode: 'BYOK_ONLY' | 'VAULT_ONLY' | 'EITHER'): Observable<ProviderKeyMode> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.patch<ProviderKeyMode>(
          `${this.baseUrl}/v1/orgs/${orgId}/provider-key-mode`,
          { provider_key_mode: mode },
          { headers }
        )
      )
    );
  }
}
