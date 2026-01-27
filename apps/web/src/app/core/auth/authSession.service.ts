/**
 * Auth Session Service
 * 
 * Centralized auth state management with a single onAuthStateChange listener.
 * Prevents duplicate listeners that can cause LockManager contention.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthSession } from '@supabase/supabase-js';
import { supabase } from '../supabase/supabase.client';

export interface SupabaseUser {
  id: string;
  email?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService implements OnDestroy {
  private session$ = new BehaviorSubject<AuthSession | null>(null);
  private user$ = new BehaviorSubject<SupabaseUser | null>(null);
  private authSubscription: { unsubscribe(): void } | null = null;
  private initialized = false;

  constructor() {
    this.initOnce();
  }

  /**
   * Initialize auth listener exactly once
   */
  private initOnce() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    console.debug('[auth] initializing auth state listener');

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          // LockManager errors are non-critical
          if (error.message?.includes('LockManager') || error.message?.includes('lock')) {
            console.warn('[auth] LockManager warning (non-critical):', error.message);
            this.tryGetSessionFromStorage();
          } else {
            console.error('[auth] Session initialization error:', error);
          }
        } else {
          this.updateSession(session);
        }
      })
      .catch((error) => {
        // LockManager errors are non-critical
        if (error?.message?.includes('LockManager') || error?.message?.includes('lock')) {
          console.warn('[auth] LockManager warning (non-critical):', error.message);
          this.tryGetSessionFromStorage();
        } else {
          console.error('[auth] Session initialization error:', error);
        }
      });

    // Attach exactly one auth state change listener
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.debug('[auth] state changed:', event, session?.user?.email || 'no user');
      this.updateSession(session);
    });
    // Store subscription for cleanup
    this.authSubscription = data.subscription;
  }

  /**
   * Update session and user state
   */
  private updateSession(session: AuthSession | null) {
    this.session$.next(session);
    this.user$.next(
      session?.user
        ? { id: session.user.id, email: session.user.email || undefined }
        : null
    );
  }

  /**
   * Fallback: Try to get session from localStorage if LockManager fails
   */
  private tryGetSessionFromStorage() {
    try {
      const projectRef = supabase.supabaseUrl.split('//')[1]?.split('.')[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.currentSession) {
          this.updateSession(parsed.currentSession);
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
   * Get current access token
   */
  async getAccessToken(): Promise<string | null> {
    // First try current session
    let session = this.session$.value;
    if (session?.access_token) {
      return session.access_token;
    }

    // If no session, try to get it fresh from Supabase
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      if (freshSession) {
        this.updateSession(freshSession);
        return freshSession.access_token || null;
      }
    } catch (error) {
      // LockManager errors are non-critical
      if (error?.message?.includes('LockManager') || error?.message?.includes('lock')) {
        console.warn('[auth] LockManager warning (non-critical):', error);
      }
    }

    return null;
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
    }
  }
}
