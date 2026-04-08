Desktop installers for the /download page (same-origin URLs in environment.*)

The Electron desktop build (ng build --configuration desktop) does NOT bundle these
files — see angular.json "desktop" assets ignore — so the Mac .app is not hundreds
of MB larger from embedding a copy of itself. Production web/Netlify builds still
include them when present under src/assets/downloads/.

Expected filenames (see desktopDownloadsSameOrigin):
  Spectyra-mac.dmg
  Spectyra-windows.exe
  Spectyra-windows.zip   (optional portable)

OpenClaw + Spectyra bundle (see openclawDesktopDownloadsSameOrigin in environment.*):
  Spectyra-OpenClaw-mac.dmg
  Spectyra-OpenClaw-windows.exe
  Spectyra-OpenClaw-windows.zip   (optional portable)

These files are listed in .gitignore (*.dmg, *.exe, *.zip) so they are NOT committed to git.
Add them locally before a Netlify deploy, or host elsewhere and set DESKTOP_DOWNLOAD_* on the API.
For the OpenClaw bundle, set OPENCLAW_DESKTOP_DOWNLOAD_MAC_URL, OPENCLAW_DESKTOP_DOWNLOAD_WINDOWS_URL,
and optionally OPENCLAW_DESKTOP_DOWNLOAD_WINDOWS_ZIP_URL on the API.

Windows .exe:
  1) On Windows (or CI windows-latest): pnpm desktop:dist:win  from repo root
  2) From apps/desktop/release/ copy the NSIS file (e.g. Spectyra-1.0.0-win-x64.exe)
     into THIS folder and rename to:  Spectyra-windows.exe
  3) Deploy the web app so the file ends up at /assets/downloads/Spectyra-windows.exe

macOS .dmg: same idea — rename build output to Spectyra-mac.dmg here before deploy.
