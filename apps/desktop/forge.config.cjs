module.exports = {
  packagerConfig: {
    name: "Spectyra",
    executableName: "spectyra",
    asar: true,
    icon: "./icons/icon",
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "linux", "win32"],
    },
    {
      name: "@electron-forge/maker-dmg",
      config: { name: "Spectyra" },
    },
    {
      name: "@electron-forge/maker-squirrel",
      config: { name: "Spectyra" },
    },
  ],
};
