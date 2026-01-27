/**
 * Supabase Client Singleton
 * 
 * Ensures exactly one Supabase client instance per browser tab.
 * Prevents Navigator LockManager errors from duplicate client creation.
 * 
 * Uses lazy initialization to avoid creating the client until it's actually needed.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// Global singleton guard (prevents duplicate init in dev/HMR)
const g = globalThis as any;
const GLOBAL_KEY = '__spectyra_supabase_client__';

let _client: SupabaseClient | null = null;
let _initializing = false;

/**
 * Get the singleton Supabase client instance
 * Creates it on first call, returns existing instance on subsequent calls
 * Uses lazy initialization to avoid early creation
 */
export function getSupabaseClient(): SupabaseClient {
  // Check global first (for HMR/dev scenarios)
  if (g[GLOBAL_KEY]) {
    _client = g[GLOBAL_KEY] as SupabaseClient;
    return _client;
  }

  // Check local singleton
  if (_client) {
    return _client;
  }

  // Prevent concurrent initialization
  if (_initializing) {
    // Wait a bit and retry (shouldn't happen, but safety check)
    throw new Error('Supabase client is being initialized, please retry');
  }

  _initializing = true;

  try {
    // Create new client (only once)
    console.debug('[supabase] client created', Date.now());
    
    // Extract project ref for storage key
    const projectRef = environment.supabaseUrl.split('//')[1]?.split('.')[0] || 'spectyra';
    
    // Suppress LockManager warnings during initialization (they're harmless)
    const originalWarn = console.warn;
    const suppressedWarnings: string[] = [];
    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      // Suppress LockManager warnings (they're non-critical browser API warnings)
      if (message.includes('LockManager') || message.includes('lock:sb-')) {
        suppressedWarnings.push(message);
        // Only log once per session to avoid spam
        if (suppressedWarnings.length === 1) {
          console.debug('[supabase] LockManager warning suppressed (non-critical, can be ignored)');
        }
        return;
      }
      originalWarn.apply(console, args);
    };
    
    try {
      _client = createClient(
        environment.supabaseUrl,
        environment.supabaseAnonKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            // Use a consistent storage key to reduce lock contention
            storageKey: `sb-${projectRef}-auth-token`,
          },
        }
      );
    } finally {
      // Restore original console.warn
      console.warn = originalWarn;
    }

    // Store in global for HMR/dev scenarios
    g[GLOBAL_KEY] = _client;

    return _client;
  } finally {
    _initializing = false;
  }
}

/**
 * Lazy singleton getter
 * Only creates the client when first accessed
 */
let _lazyClient: SupabaseClient | null = null;

function getLazyClient(): SupabaseClient {
  if (!_lazyClient) {
    _lazyClient = getSupabaseClient();
  }
  return _lazyClient;
}

/**
 * Exported singleton instance (lazy)
 * Use this for direct access: import { supabase } from './supabase.client'
 * 
 * NOTE: This is lazy-loaded to avoid early initialization that can trigger
 * LockManager warnings during app bootstrap.
 * 
 * The Proxy ensures the client is only created when first accessed, not at module load time.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getLazyClient();
    const value = (client as any)[prop];
    // If it's a function, bind it to the client
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
