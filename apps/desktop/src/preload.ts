/**
 * Preload script — exposes a safe IPC bridge to the renderer.
 *
 * Everything here is available as `window.spectyra.*` in the UI.
 * No Node APIs leak to the renderer.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("spectyra", {
  companion: {
    start: () => ipcRenderer.invoke("companion:start"),
    stop: () => ipcRenderer.invoke("companion:stop"),
    status: () => ipcRenderer.invoke("companion:status"),
    health: () => ipcRenderer.invoke("companion:health"),
  },

  config: {
    get: () => ipcRenderer.invoke("config:get"),
    save: (partial: Record<string, unknown>) => ipcRenderer.invoke("config:save", partial),
  },

  providerKey: {
    set: (provider: string, key: string) => ipcRenderer.invoke("provider-key:set", provider, key),
    test: (provider: string) => ipcRenderer.invoke("provider-key:test", provider),
  },

  license: {
    activate: (key: string) => ipcRenderer.invoke("license:activate", key),
    check: () => ipcRenderer.invoke("license:check"),
    clear: () => ipcRenderer.invoke("license:clear"),
  },

  app: {
    info: () => ipcRenderer.invoke("app:info"),
    openDataDir: () => ipcRenderer.invoke("app:open-data-dir"),
  },

  onLog: (cb: (msg: string) => void) => {
    ipcRenderer.on("companion-log", (_e, msg) => cb(msg));
  },
  onStatus: (cb: (status: { running: boolean; port?: number; code?: number }) => void) => {
    ipcRenderer.on("companion-status", (_e, s) => cb(s));
  },
});
