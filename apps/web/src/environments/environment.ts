export const environment = {
  production: false,
  /** Fallback for auth email links when `window` has no http(s) origin (e.g. file://). */
  publicSiteUrl: 'http://localhost:4200',
  /** Set true only in environment.desktop.ts — Electron renderer. */
  isDesktop: false,
  /** Local Companion (same host as Electron main). */
  companionBaseUrl: 'http://127.0.0.1:4111',
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
    /** Portable zip — leave empty if not hosted in-repo (use API `DESKTOP_DOWNLOAD_WINDOWS_ZIP_URL`). */
    windowsPortablePath: '',
  },
  /** Optional override URLs for the OpenClaw + Spectyra bundle (same pattern as desktop). */
  openclawDesktopDownloadsFallback: {
    macUrl: '',
    windowsUrl: '',
    windowsZipUrl: '',
  },
  openclawDesktopDownloadsSameOrigin: {
    macPath: '/assets/downloads/Spectyra-OpenClaw-mac.dmg',
    windowsInstallerPath: '/assets/downloads/Spectyra-OpenClaw-windows.exe',
    windowsPortablePath: '',
  },
};
