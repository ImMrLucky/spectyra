/**
 * Supabase Service
 * 
 * Wrapper around the singleton Supabase client.
 * Provides convenience methods for auth operations.
 * 
 * NOTE: The actual Supabase client is created once in supabase.client.ts
 * This service uses the centralized AuthSessionService for session management.
 */

import { Injectable } from '@angular/core';
import { SupabaseClient, AuthSession } from '@supabase/supabase-js';
import { Observable } from 'rxjs';
import { supabase } from '../core/supabase/supabase.client';
import { AuthSessionService, SupabaseUser } from '../core/auth/authSession.service';

// Re-export for backward compatibility
export type { SupabaseUser } from '../core/auth/authSession.service';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  constructor(private authSession: AuthSessionService) {}

  /**
   * Get current session as Observable
   * Delegates to centralized AuthSessionService
   */
  getSession(): Observable<AuthSession | null> {
    return this.authSession.getSession();
  }

  /**
   * Get current user as Observable
   * Delegates to centralized AuthSessionService
   */
  getUser(): Observable<SupabaseUser | null> {
    return this.authSession.getUser();
  }

  /**
   * Get current access token (for API calls)
   * Delegates to centralized AuthSessionService
   */
  async getAccessToken(): Promise<string | null> {
    return this.authSession.getAccessToken();
  }

  /**
   * Sign in with email (magic link or password)
   */
  async signIn(email: string, password?: string): Promise<{ error: Error | null }> {
    if (password) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } else {
      // Magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
      });
      return { error };
    }
  }

  /**
   * Sign up with email
   */
  async signUp(email: string, password: string): Promise<{ error: Error | null; session: AuthSession | null; user: any }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    // Session will be updated automatically by AuthSessionService listener
    // No need to manually update here
    
    return { error, session: data.session || null, user: data.user || null };
  }

  /**
   * Sign out
   */
  async signOut(): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    // Use a synchronous check via BehaviorSubject value
    let hasSession = false;
    this.authSession.getSession().subscribe(session => {
      hasSession = !!session;
    }).unsubscribe();
    return hasSession;
  }

  /**
   * Get Supabase client (for direct access if needed)
   * Returns the singleton client instance
   */
  getClient(): SupabaseClient {
    return supabase;
  }
}
