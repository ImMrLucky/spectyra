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
  /** Production web origin — used for auth email links when origin is not http(s) (e.g. desktop file://). */
  publicSiteUrl: 'https://spectyra.netlify.app',
  isDesktop: false,
  companionBaseUrl: 'http://127.0.0.1:4111',
  apiUrl: 'https://spectyra.up.railway.app/v1',
  supabaseUrl: 'https://jajqvceuenqeblbgsigt.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphanF2Y2V1ZW5xZWJsYmdzaWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDI4MDgsImV4cCI6MjA4NDk3ODgwOH0.IJ7CSyX-_-lahfaOzM9U5EIpR6tcW-GhiMZeCY_efno',
  /** Optional override URLs (e.g. CDN). If empty, same-origin paths below are used. */
  desktopDownloadsFallback: {
    macUrl: '',
    windowsUrl: '',
    windowsZipUrl: '',
  },
  /**
   * Defaults: DMG + Windows installer (.exe) + optional portable (.zip).
   * See apps/desktop/RELEASING.md for how each file is produced.
   */
  desktopDownloadsSameOrigin: {
    macPath: '/assets/downloads/Spectyra-mac.dmg',
    windowsInstallerPath: '/assets/downloads/Spectyra-windows.exe',
    /** Portable zip — leave empty if not in Netlify assets (use API `DESKTOP_DOWNLOAD_WINDOWS_ZIP_URL`). */
    windowsPortablePath: '',
  },
};
