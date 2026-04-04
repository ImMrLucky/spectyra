/**
 * Preload — exposes `window.spectyra` and desktop flags for the Angular renderer.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("spectyra", {
  companion: {
    start: () => ipcRenderer.invoke("companion:start"),
    stop: () => ipcRenderer.invoke("companion:stop"),
    status: () => ipcRenderer.invoke("companion:status"),
    health: () => ipcRenderer.invoke("companion:health"),
    getSetupStatus: () => ipcRenderer.invoke("companion:get-setup-status"),
  },

  config: {
    get: () => ipcRenderer.invoke("config:get"),
    save: (partial: Record<string, unknown>) => ipcRenderer.invoke("config:save", partial),
  },

  providerKey: {
    set: (provider: string, key: string) => ipcRenderer.invoke("provider-key:set", provider, key),
    test: (provider: string) => ipcRenderer.invoke("provider-key:test", provider),
    clear: () => ipcRenderer.invoke("provider-keys:clear") as Promise<boolean>,
    setActive: (provider: string) =>
      ipcRenderer.invoke("provider:set-active", provider) as Promise<{ ok: true } | { ok: false; error: string }>,
  },

  license: {
    activate: (key: string) => ipcRenderer.invoke("license:activate", key),
    check: () => ipcRenderer.invoke("license:check"),
    clear: () => ipcRenderer.invoke("license:clear"),
  },

  openclaw: {
    getExampleConfig: () => ipcRenderer.invoke("openclaw:example-config") as Promise<string>,
    detectCli: () => ipcRenderer.invoke("openclaw:detect-cli") as Promise<{ available: boolean }>,
    runOnboardInTerminal: (opts?: {
      flow?: "quickstart" | "manual";
      mode?: "remote";
      remoteUrl?: string;
    }) =>
      ipcRenderer.invoke("openclaw:run-onboard-terminal", opts) as Promise<{ ok: boolean; error?: string }>,
  },

  app: {
    info: () => ipcRenderer.invoke("app:info"),
    companionBaseUrl: () => ipcRenderer.invoke("app:companion-base-url") as Promise<string>,
    openDataDir: () => ipcRenderer.invoke("app:open-data-dir"),
  },

  openclawHub: {
    configPath: () => ipcRenderer.invoke("openclaw:config-path"),
    doctor: () => ipcRenderer.invoke("openclaw:doctor"),
    dashboardCheck: () => ipcRenderer.invoke("openclaw:dashboard-check"),
    gatewayCheck: () => ipcRenderer.invoke("openclaw:gateway-check"),
    skillsSearch: (query: string) => ipcRenderer.invoke("openclaw:skills-search", query),
    skillsInstalled: () => ipcRenderer.invoke("openclaw:skills-installed"),
    skillsInstall: (name: string) => ipcRenderer.invoke("openclaw:skills-install", name),
    skillsUpdate: () => ipcRenderer.invoke("openclaw:skills-update"),
    openPath: (target: string) => ipcRenderer.invoke("openclaw:open-path", target),
    openConfig: () => ipcRenderer.invoke("openclaw:open-config"),
    openLogs: () => ipcRenderer.invoke("openclaw:open-logs"),
    profilesList: () => ipcRenderer.invoke("spectyra:profiles-list"),
    profilesSave: (profiles: unknown[]) => ipcRenderer.invoke("spectyra:profiles-save", profiles),
    tasksList: () => ipcRenderer.invoke("spectyra:tasks-list"),
    tasksSave: (tasks: unknown[]) => ipcRenderer.invoke("spectyra:tasks-save", tasks),
  },

  onStatus: (cb: (status: { running: boolean; port?: number; code?: number }) => void) => {
    ipcRenderer.on("companion-status", (_e, s) => cb(s));
  },
});

contextBridge.exposeInMainWorld("spectyraDesktop", {
  isDesktop: true,
});
