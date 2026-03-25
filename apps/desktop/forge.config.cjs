/**
 * Squirrel (Setup.exe) only runs on Windows hosts (or macOS with Wine+Mono).
 * Cross-platform `make --platform win32` from macOS uses zip only.
 */
const makers = [
  {
    name: "@electron-forge/maker-zip",
    platforms: ["darwin", "linux", "win32"],
  },
  {
    name: "@electron-forge/maker-dmg",
    platforms: ["darwin"],
    config: { name: "Spectyra" },
  },
];

if (process.platform === "win32") {
  makers.push({
    name: "@electron-forge/maker-squirrel",
    config: { name: "Spectyra" },
  });
}

module.exports = {
  packagerConfig: {
    name: "Spectyra",
    executableName: "spectyra",
    asar: true,
    icon: "./icons/icon",
  },
  makers,
};
