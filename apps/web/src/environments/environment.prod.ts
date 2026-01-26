/**
 * Production environment configuration
 * 
 * This file is automatically used when building with --configuration production
 * (configured in angular.json fileReplacements)
 * 
 * Note: Supabase anon key is safe to expose - it's public by design and
 * protected by RLS policies on the backend.
 */
export const environment = {
  production: true,
  apiUrl: 'https://spectyra.up.railway.app/v1',
  supabaseUrl: 'https://jajqvceuenqeblbgsigt.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphanF2Y2V1ZW5xZWJsYmdzaWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDI4MDgsImV4cCI6MjA4NDk3ODgwOH0.IJ7CSyX-_-lahfaOzM9U5EIpR6tcW-GhiMZeCY_efno',
};
