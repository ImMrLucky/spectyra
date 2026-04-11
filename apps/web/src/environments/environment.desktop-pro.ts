/**
 * Spectyra Desktop Pro — full-featured edition.
 * Same companion & API endpoints as the OpenClaw edition; different route bundle.
 */
export const environment = {
  web3formsAccessKey: '424167d5-572f-4cf8-984e-2c3c4c54cd18',
  production: true,
  publicSiteUrl: 'https://spectyra.ai',
  isDesktop: true,
  isDesktopPro: true,
  companionBaseUrl: 'http://127.0.0.1:4111',
  apiUrl: 'https://spectyra.ai/v1',
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
