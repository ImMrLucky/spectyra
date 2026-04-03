/**
 * Remove previous electron-builder output under `release/` so new dist runs do not
 * leave stale DMG/ZIP/exe/unpacked folders next to fresh artifacts.
 */
const fs = require("fs");
const path = require("path");

const release = path.join(__dirname, "..", "release");
if (!fs.existsSync(release)) {
  fs.mkdirSync(release, { recursive: true });
  process.exit(0);
}

for (const name of fs.readdirSync(release)) {
  try {
    fs.rmSync(path.join(release, name), { recursive: true, force: true });
  } catch (e) {
    // macOS: Finder or previous DMG mount can leave dirs with EACCES.
    // chmod then retry once.
    try {
      fs.chmodSync(path.join(release, name), 0o755);
      fs.rmSync(path.join(release, name), { recursive: true, force: true });
    } catch {
      console.warn(`clean-release: could not remove ${name}: ${e.message}`);
    }
  }
}
