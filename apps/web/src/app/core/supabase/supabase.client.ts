/**
 * Supabase Client Singleton
 * 
 * Ensures exactly one Supabase client instance per browser tab.
 * Prevents Navigator LockManager errors from duplicate client creation.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// Global singleton guard (prevents duplicate init in dev/HMR)
const g = globalThis as any;
const GLOBAL_KEY = '__spectyra_supabase_client__';

let _client: SupabaseClient | null = null;

/**
 * Get the singleton Supabase client instance
 * Creates it on first call, returns existing instance on subsequent calls
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

  // Create new client (only once)
  console.debug('[supabase] client created', Date.now());
  
  _client = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  // Store in global for HMR/dev scenarios
  g[GLOBAL_KEY] = _client;

  return _client;
}

/**
 * Exported singleton instance
 * Use this for direct access: import { supabase } from './supabase.client'
 */
export const supabase = getSupabaseClient();
