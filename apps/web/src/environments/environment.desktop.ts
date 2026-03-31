/**
 * Electron desktop renderer — local-first; hash routing for file:// loads.
 */
export const environment = {
  production: true,
  publicSiteUrl: 'https://spectyra.ai',
  isDesktop: true,
  companionBaseUrl: 'http://127.0.0.1:4111',
  apiUrl: 'https://spectyra.up.railway.app/v1',
  supabaseUrl: 'https://jajqvceuenqeblbgsigt.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphanF2Y2V1ZW5xZWJsYmdzaWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDI4MDgsImV4cCI6MjA4NDk3ODgwOH0.IJ7CSyX-_-lahfaOzM9U5EIpR6tcW-GhiMZeCY_efno',
  desktopDownloadsFallback: {
    macUrl: '',
    windowsUrl: '',
    windowsZipUrl: '',
  },
  desktopDownloadsSameOrigin: {
    macPath: '/assets/downloads/Spectyra-mac.dmg',
    windowsInstallerPath: '/assets/downloads/Spectyra-windows.exe',
    windowsPortablePath: '',
  },
};
