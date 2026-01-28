/**
 * Supabase Admin API Types
 * 
 * Types for Supabase Admin API responses (auth/v1/admin/users)
 */

/**
 * Supabase Admin API User Response
 * 
 * Response from GET /auth/v1/admin/users/{id}
 * Based on Supabase GoTrue Admin API
 */
export interface SupabaseAdminUser {
  id: string;
  email?: string;
  user_metadata?: {
    email?: string;
    provider?: string;
    [key: string]: any;
  };
  app_metadata?: {
    provider?: string;
    providers?: string[];
    [key: string]: any;
  };
  [key: string]: any; // Allow other fields from Supabase response
}
