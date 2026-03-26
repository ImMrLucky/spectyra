/**
 * electron-builder skips rebuilding *.zip when the existing archive mtime is newer than
 * the app folder ("Archive file is up to date"), which can leave a stale zip next to a
 * fresh .exe. Remove Windows zip artifacts before `electron-builder --win` when you
 * need a guaranteed fresh zip.
 */
const fs = require("fs");
const path = require("path");

const release = path.join(__dirname, "..", "release");
if (!fs.existsSync(release)) process.exit(0);

for (const f of fs.readdirSync(release)) {
  if (f.includes("-win-") && (f.endsWith(".zip") || f.endsWith(".zip.blockmap"))) {
    fs.unlinkSync(path.join(release, f));
  }
}
