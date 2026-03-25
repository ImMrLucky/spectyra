export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/v1',
  supabaseUrl: 'https://jajqvceuenqeblbgsigt.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphanF2Y2V1ZW5xZWJsYmdzaWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDI4MDgsImV4cCI6MjA4NDk3ODgwOH0.IJ7CSyX-_-lahfaOzM9U5EIpR6tcW-GhiMZeCY_efno',
  /** Optional absolute URLs if not using same-origin assets below. */
  desktopDownloadsFallback: {
    macUrl: '',
    /** Windows installer (.exe). */
    windowsUrl: '',
    windowsZipUrl: '',
  },
  /**
   * Installers co-located with the Angular app (copied to /assets/downloads/ on build).
   * At runtime, links are `${origin}${path}`. Add files under src/assets/downloads/.
   */
  desktopDownloadsSameOrigin: {
    macPath: '/assets/downloads/Spectyra-mac.dmg',
    windowsInstallerPath: '/assets/downloads/Spectyra-windows.exe',
    windowsPortablePath: '/assets/downloads/Spectyra-windows.zip',
  },
};
