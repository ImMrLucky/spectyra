import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  trial_ends_at: string | null;
  subscription_active: boolean;
}

export interface AuthState {
  user: User | null;
  apiKey: string | null;
  hasAccess: boolean;
  trialActive: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private baseUrl = environment.apiUrl;
  private apiKeyStorageKey = 'spectyra_api_key';
  private userStorageKey = 'spectyra_user';
  
  private authState$ = new BehaviorSubject<AuthState>({
    user: null,
    apiKey: null,
    hasAccess: false,
    trialActive: false,
  });

  constructor(private http: HttpClient) {
    // Load from storage on init
    this.loadFromStorage();
  }

  get authState(): Observable<AuthState> {
    return this.authState$.asObservable();
  }

  get currentUser(): User | null {
    return this.authState$.value.user;
  }

  get currentApiKey(): string | null {
    return this.authState$.value.apiKey;
  }

  get hasAccess(): boolean {
    return this.authState$.value.hasAccess;
  }

  /**
   * Register a new organization
   */
  register(orgName: string, projectName?: string): Observable<{ org: any; project: any; api_key: string; api_key_id: string }> {
    return this.http.post<{ org: any; project: any; api_key: string; api_key_id: string }>(
      `${this.baseUrl}/auth/register`,
      { org_name: orgName, project_name: projectName }
    ).pipe(
      tap(response => {
        // Store API key
        this.setApiKey(response.api_key);
        // Map org to user for backward compatibility
        const user: User = {
          id: response.org.id,
          email: `${response.org.name}@spectyra.local`, // Use org name as email placeholder
          trial_ends_at: response.org.trial_ends_at,
          subscription_active: response.org.subscription_status === 'active',
        };
        this.setUser(user);
        this.checkAccess();
      })
    );
  }

  /**
   * Login with API key
   */
  login(apiKey: string): Observable<{ org: any; project: any; has_access: boolean }> {
    return this.http.post<{ org: any; project: any; has_access: boolean }>(
      `${this.baseUrl}/auth/login`,
      {},
      { headers: { 'X-SPECTYRA-API-KEY': apiKey } }
    ).pipe(
      tap(response => {
        this.setApiKey(apiKey);
        // Map org to user for backward compatibility
        const user: User = {
          id: response.org.id,
          email: `${response.org.id}@spectyra.local`, // Placeholder
          trial_ends_at: response.org.trial_ends_at,
          subscription_active: response.org.subscription_status === 'active',
        };
        this.setUser(user);
        this.updateAuthState({ hasAccess: response.has_access });
      })
    );
  }

  /**
   * Get current user info
   */
  getMe(): Observable<{ org: any; project: any; has_access: boolean; trial_active: boolean }> {
    const apiKey = this.currentApiKey;
    if (!apiKey) {
      throw new Error('No API key found');
    }

    return this.http.get<{ org: any; project: any; has_access: boolean; trial_active: boolean }>(
      `${this.baseUrl}/auth/me`,
      { headers: { 'X-SPECTYRA-API-KEY': apiKey } }
    ).pipe(
      tap(response => {
        // Map org to user for backward compatibility
        const user: User = {
          id: response.org.id,
          email: `${response.org.name}@spectyra.local`, // Use org name as email placeholder
          trial_ends_at: response.org.trial_ends_at,
          subscription_active: response.org.subscription_status === 'active',
        };
        this.setUser(user);
        this.updateAuthState({
          hasAccess: response.has_access,
          trialActive: response.trial_active,
        });
      })
    );
  }

  /**
   * Create a new API key
   */
  createApiKey(name?: string, projectId?: string): Observable<{ id: string; key: string; name: string | null; project_id: string | null; created_at: string }> {
    const apiKey = this.currentApiKey;
    if (!apiKey) {
      throw new Error('No API key found');
    }

    return this.http.post<{ id: string; key: string; name: string | null; project_id: string | null; created_at: string }>(
      `${this.baseUrl}/auth/api-keys`,
      { name, project_id: projectId },
      { headers: { 'X-SPECTYRA-API-KEY': apiKey } }
    );
  }

  /**
   * List API keys
   */
  listApiKeys(): Observable<Array<{ id: string; name: string | null; project_id: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null }>> {
    const apiKey = this.currentApiKey;
    if (!apiKey) {
      throw new Error('No API key found');
    }

    return this.http.get<Array<{ id: string; name: string | null; project_id: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null }>>(
      `${this.baseUrl}/auth/api-keys`,
      { headers: { 'X-SPECTYRA-API-KEY': apiKey } }
    );
  }

  /**
   * Delete an API key
   */
  deleteApiKey(keyId: string): Observable<{ success: boolean }> {
    const apiKey = this.currentApiKey;
    if (!apiKey) {
      throw new Error('No API key found');
    }

    return this.http.delete<{ success: boolean }>(
      `${this.baseUrl}/auth/api-keys/${keyId}`,
      { headers: { 'X-SPECTYRA-API-KEY': apiKey } }
    );
  }

  /**
   * Logout (clear storage)
   */
  logout(): void {
    localStorage.removeItem(this.apiKeyStorageKey);
    localStorage.removeItem(this.userStorageKey);
    this.updateAuthState({
      user: null,
      apiKey: null,
      hasAccess: false,
      trialActive: false,
    });
  }

  /**
   * Set API key (public for bootstrap flow)
   */
  setApiKey(key: string): void {
    localStorage.setItem(this.apiKeyStorageKey, key);
    this.updateAuthState({ apiKey: key });
  }

  /**
   * Set user
   */
  private setUser(user: User): void {
    localStorage.setItem(this.userStorageKey, JSON.stringify(user));
    this.updateAuthState({ user });
  }

  /**
   * Load from storage
   */
  private loadFromStorage(): void {
    const apiKey = localStorage.getItem(this.apiKeyStorageKey);
    const userStr = localStorage.getItem(this.userStorageKey);
    const user = userStr ? JSON.parse(userStr) : null;

    if (apiKey && user) {
      this.updateAuthState({ apiKey, user });
      // Check access asynchronously
      this.checkAccess();
    }
  }

  /**
   * Check access status
   */
  private checkAccess(): void {
    const user = this.currentUser;
    if (!user) return;

    const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
    const trialActive = trialEnd ? trialEnd > new Date() : false;
    const hasAccess = user.subscription_active || trialActive;

    this.updateAuthState({
      hasAccess,
      trialActive,
    });
  }

  /**
   * Update auth state
   */
  private updateAuthState(updates: Partial<AuthState>): void {
    const current = this.authState$.value;
    this.authState$.next({ ...current, ...updates });
  }
}
