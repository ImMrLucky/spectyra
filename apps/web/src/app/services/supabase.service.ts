/**
 * Supabase Service
 * 
 * Manages Supabase client and authentication
 */

import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, AuthSession } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SupabaseUser {
  id: string;
  email?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private session$ = new BehaviorSubject<AuthSession | null>(null);
  private user$ = new BehaviorSubject<SupabaseUser | null>(null);

  constructor() {
    // Create Supabase client
    // Note: Navigator LockManager errors are usually harmless and can be ignored
    // They occur when multiple tabs try to access the same auth lock simultaneously
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    );

    // Initialize session with error handling for LockManager issues
    this.supabase.auth.getSession()
      .then(({ data: { session } }) => {
        this.session$.next(session);
        this.user$.next(session?.user ? { id: session.user.id, email: session.user.email } : null);
      })
      .catch((error) => {
        // LockManager errors are non-critical - log but don't break the app
        if (error?.message?.includes('LockManager') || error?.message?.includes('lock')) {
          console.warn('Supabase LockManager warning (non-critical, can be ignored):', error.message);
          // Try to get session from localStorage as fallback
          this.tryGetSessionFromStorage();
        } else {
          // Other errors should be logged
          console.error('Supabase session initialization error:', error);
        }
      });

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session$.next(session);
      this.user$.next(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });
  }

  /**
   * Fallback: Try to get session from localStorage if LockManager fails
   */
  private tryGetSessionFromStorage() {
    try {
      // Supabase stores session with key pattern: sb-{project-ref}-auth-token
      const projectRef = environment.supabaseUrl.split('//')[1]?.split('.')[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.currentSession) {
          this.session$.next(parsed.currentSession);
          this.user$.next(parsed.currentSession.user ? { 
            id: parsed.currentSession.user.id, 
            email: parsed.currentSession.user.email 
          } : null);
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  /**
   * Get current session as Observable
   */
  getSession(): Observable<AuthSession | null> {
    return this.session$.asObservable();
  }

  /**
   * Get current user as Observable
   */
  getUser(): Observable<SupabaseUser | null> {
    return this.user$.asObservable();
  }

  /**
   * Get current access token (for API calls)
   */
  async getAccessToken(): Promise<string | null> {
    // First try current session
    let session = this.session$.value;
    if (session?.access_token) {
      return session.access_token;
    }
    
    // If no session, try to get it fresh from Supabase
    const { data: { session: freshSession } } = await this.supabase.auth.getSession();
    if (freshSession) {
      this.session$.next(freshSession);
      this.user$.next(freshSession.user ? { id: freshSession.user.id, email: freshSession.user.email } : null);
      return freshSession.access_token || null;
    }
    
    return null;
  }

  /**
   * Sign in with email (magic link or password)
   */
  async signIn(email: string, password?: string): Promise<{ error: Error | null }> {
    if (password) {
      const { error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } else {
      // Magic link
      const { error } = await this.supabase.auth.signInWithOtp({
        email,
      });
      return { error };
    }
  }

  /**
   * Sign up with email
   */
  async signUp(email: string, password: string): Promise<{ error: Error | null; session: AuthSession | null; user: any }> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });
    
    // Update session immediately if available
    if (data.session) {
      this.session$.next(data.session);
      this.user$.next(data.session.user ? { id: data.session.user.id, email: data.session.user.email } : null);
    } else if (data.user && !data.session) {
      // User created but no session (email confirmation required)
      console.log('User created but session not available - email confirmation may be required');
    }
    
    return { error, session: data.session || null, user: data.user || null };
  }

  /**
   * Sign out
   */
  async signOut(): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.auth.signOut();
    return { error };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.session$.value;
  }

  /**
   * Get Supabase client (for direct access if needed)
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }
}
